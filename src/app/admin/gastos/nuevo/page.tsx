'use client'

import { useState, useEffect } from 'react'
import { useRouter }          from 'next/navigation'
import { useAuthContext }     from '@/components/auth/AuthProvider'
import { PageHeader }         from '@/components/layout/PageHeader'
import { Spinner }            from '@/components/ui'
import { db }                 from '@/lib/firebase/config'
import { collection, getDocs } from 'firebase/firestore'
import {
  createGasto, getPeriodoActual, logAudit, getCategorias,
  getMediosPago, searchProveedores,
} from '@/lib/firebase/admin'
import type {
  Gasto, GastoTipo, GastoEstado, Moneda,
  Categoria, MedioPago, Proveedor, DistribucionSocio,
} from '@/types/admin'
import {
  SOCIOS, GASTO_TIPO_LABEL, MEDIO_PAGO_TIPO_LABEL, CATEGORIAS_INICIALES,
} from '@/types/admin'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Timestamp } from 'firebase/firestore'
import { ArrowLeft, Save, Users, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function NuevoGastoPage() {
  const router = useRouter()
  const { user, profile } = useAuthContext()

  const [saving,      setSaving]      = useState(false)
  const [categorias,  setCategorias]  = useState<Categoria[]>([])
  const [medios,      setMedios]      = useState<MedioPago[]>([])
  const [provSearch,  setProvSearch]  = useState('')
  const [provSuggs,   setProvSuggs]   = useState<Proveedor[]>([])

  // Form state
  const [form, setForm] = useState({
    fecha:          format(new Date(), 'yyyy-MM-dd'),
    periodo:        getPeriodoActual(),
    proveedorId:    '',
    proveedorNombre: '',
    descripcion:    '',
    categoriaId:    '',
    categoriaNombre: '',
    tipo:           'operating' as GastoTipo,
    importe:        '',
    moneda:         'ARS' as Moneda,
    tipoCambio:     '',
    medioPagoId:    '',
    medioPagoNombre: '',
    pagadoPorUid:   user?.uid ?? '',
    pagadoPorNombre: profile?.nombre ?? '',
    estado:         'paid' as GastoEstado,
    clienteId:      '',
    clienteNombre:  '',
    proyectoId:     '',
    proyectoNombre: '',
    esReintegrable: false,
    distribuirEntreSocios: true,
    notas:          '',
    tags:           '',
  })

  const [distribucion, setDistribucion] = useState<DistribucionSocio[]>(
    SOCIOS.map(s => ({
      uid:        s.uid,
      nombre:     s.nombre,
      porcentaje: 33.33,
      monto:      0,
      moneda:     'ARS' as Moneda,
      pagado:     false,
    }))
  )

  useEffect(() => {
    getCategorias().then(setCategorias)
    getMediosPago().then(setMedios)
  }, [])

  useEffect(() => {
    if (!user || !profile) return
    setForm(f => ({
      ...f,
      pagadoPorUid:    user.uid,
      pagadoPorNombre: profile.nombre,
    }))
  }, [user, profile])

  // Recalculate distribution amounts when importe changes
  useEffect(() => {
    const monto = parseFloat(form.importe) || 0
    setDistribucion(prev => prev.map(d => ({
      ...d,
      monto:  (monto * d.porcentaje) / 100,
      moneda: form.moneda,
    })))
  }, [form.importe, form.moneda])

  function updatePorcentaje(uid: string, pct: number) {
    const monto = parseFloat(form.importe) || 0
    setDistribucion(prev => prev.map(d =>
      d.uid === uid
        ? { ...d, porcentaje: pct, monto: (monto * pct) / 100 }
        : d
    ))
  }

  function setPagadoPor(uid: string) {
    const socio = SOCIOS.find(s => s.uid === uid)
    if (!socio) return
    setForm(f => ({ ...f, pagadoPorUid: uid, pagadoPorNombre: socio.nombre }))
  }

  function setCategoria(id: string) {
    const cat = categorias.find(c => c.id === id)
    setForm(f => ({
      ...f,
      categoriaId:    id,
      categoriaNombre: cat?.nombre ?? '',
    }))
  }

  function setMedioPago(id: string) {
    const m = medios.find(mp => mp.id === id)
    setForm(f => ({
      ...f,
      medioPagoId:    id,
      medioPagoNombre: m?.nombre ?? '',
    }))
  }

  async function handleSearchProv(term: string) {
    setProvSearch(term)
    setForm(f => ({ ...f, proveedorNombre: term, proveedorId: '' }))
    if (term.length >= 2) {
      const results = await searchProveedores(term)
      setProvSuggs(results)
    } else {
      setProvSuggs([])
    }
  }

  function selectProveedor(p: Proveedor) {
    setForm(f => ({
      ...f,
      proveedorId:     p.id,
      proveedorNombre: p.nombre,
      categoriaId:     p.categoriaPorDefectoId ?? f.categoriaId,
      categoriaNombre: p.categoriaPorDefectoNombre ?? f.categoriaNombre,
      tipo:            p.tipoPorDefecto ?? f.tipo,
      moneda:          p.monedaPorDefecto ?? f.moneda,
    }))
    setProvSearch(p.nombre)
    setProvSuggs([])
  }

  async function handleSubmit() {
    if (!user || !profile) return
    if (!form.proveedorNombre || !form.descripcion || !form.importe || !form.categoriaNombre) {
      alert('Completá los campos obligatorios: proveedor, descripción, importe y categoría.')
      return
    }

    setSaving(true)
    try {
      const monto = parseFloat(form.importe)
      const tc    = form.tipoCambio ? parseFloat(form.tipoCambio) : undefined
      const importeARS = form.moneda !== 'ARS' && tc ? monto * tc : undefined

      const gastoData = {
        fecha:          Timestamp.fromDate(new Date(form.fecha)),
        periodo:        form.periodo,
        descripcion:    form.descripcion,
        tipo:           form.tipo,
        fuente:         'manual' as const,
        importe:        monto,
        moneda:         form.moneda,
        ...(tc          && { tipoCambio: tc }),
        ...(importeARS  && { importeARS }),
        proveedorId:    form.proveedorId || undefined,
        proveedorNombre: form.proveedorNombre,
        categoriaId:    form.categoriaId || undefined,
        categoriaNombre: form.categoriaNombre,
        cargadoPorUid:   user.uid,
        cargadoPorNombre: profile.nombre,
        cargadoPorEmail:  user.email ?? '',
        pagadoPorUid:    form.pagadoPorUid,
        pagadoPorNombre: form.pagadoPorNombre,
        medioPagoId:     form.medioPagoId || undefined,
        medioPagoNombre: form.medioPagoNombre || undefined,
        clienteId:       form.clienteId || undefined,
        clienteNombre:   form.clienteNombre || undefined,
        proyectoId:      form.proyectoId || undefined,
        proyectoNombre:  form.proyectoNombre || undefined,
        tieneComprobante: false,
        distribuirEntreSocios: form.distribuirEntreSocios,
        distribucion:    form.distribuirEntreSocios ? distribucion : undefined,
        estado:          form.estado,
        approvalStatus:  'not_required' as const,
        esReintegrable:  form.esReintegrable,
        esRecurrente:    false,
        incluidoEnCierre: false,
        informadoPorMail: false,
        notas:           form.notas || undefined,
        tags:            form.tags ? form.tags.split(',').map(t => t.trim()) : undefined,
      }

      const id = await createGasto(gastoData)
      await logAudit({
        entidadTipo:   'gasto',
        entidadId:     id,
        accion:        'created',
        usuarioUid:    user.uid,
        usuarioNombre: profile.nombre,
        notas:         `Gasto manual: ${form.proveedorNombre} — $${monto}`,
      })

      router.push('/admin/gastos')
    } finally {
      setSaving(false)
    }
  }

  const totalDist = distribucion.reduce((a, d) => a + d.porcentaje, 0)
  const distOk    = Math.abs(totalDist - 100) < 0.1

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Nuevo gasto"
        subtitle="Carga manual de gasto"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/gastos" className="btn-ghost flex items-center gap-2 text-sm">
              <ArrowLeft size={14} /> Volver
            </Link>
            <button onClick={handleSubmit} disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm">
              {saving ? <Spinner size={14} /> : <Save size={14} />}
              Guardar gasto
            </button>
          </div>
        }
      />

      <div className="px-8 pb-10 max-w-3xl space-y-6">

        {/* Datos principales */}
        <div className="flux-card space-y-4">
          <h2 className="text-sm font-medium text-flux-text1 border-b border-flux-border pb-3">
            Datos del gasto
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Fecha *</label>
              <input type="date" className="flux-input"
                value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Período imputado *</label>
              <input type="month" className="flux-input"
                value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
            </div>
          </div>

          {/* Proveedor con autocomplete */}
          <div className="relative">
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Proveedor *</label>
            <input className="flux-input" placeholder="Buscar o escribir proveedor…"
              value={provSearch || form.proveedorNombre}
              onChange={e => handleSearchProv(e.target.value)} />
            {provSuggs.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover mt-1 overflow-hidden">
                {provSuggs.map(p => (
                  <button key={p.id} onClick={() => selectProveedor(p)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-flux-muted transition-colors">
                    <p className="text-flux-text1 font-medium">{p.nombre}</p>
                    {p.taxId && <p className="text-2xs text-flux-text3">CUIT: {p.taxId}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Descripción *</label>
            <input className="flux-input" placeholder="Ej: Suscripción mensual Vercel Pro — Abril 2026"
              value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Categoría *</label>
              <select className="flux-input" value={form.categoriaId}
                onChange={e => setCategoria(e.target.value)}>
                <option value="">Seleccioná categoría…</option>
                {categorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Tipo de gasto</label>
              <select className="flux-input" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as GastoTipo }))}>
                {Object.entries(GASTO_TIPO_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Montos */}
        <div className="flux-card space-y-4">
          <h2 className="text-sm font-medium text-flux-text1 border-b border-flux-border pb-3">
            Montos
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Importe *</label>
              <input type="number" min="0" step="0.01" className="flux-input"
                placeholder="0.00" value={form.importe}
                onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Moneda</label>
              <select className="flux-input" value={form.moneda}
                onChange={e => setForm(f => ({ ...f, moneda: e.target.value as Moneda }))}>
                <option value="ARS">ARS $</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
              </select>
            </div>
            {form.moneda !== 'ARS' && (
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">
                  Tipo de cambio (a ARS)
                </label>
                <input type="number" min="0" step="0.01" className="flux-input"
                  placeholder="1300" value={form.tipoCambio}
                  onChange={e => setForm(f => ({ ...f, tipoCambio: e.target.value }))} />
              </div>
            )}
          </div>
          {form.moneda !== 'ARS' && form.tipoCambio && form.importe && (
            <p className="text-xs text-flux-text3">
              ≈ $ {(parseFloat(form.importe) * parseFloat(form.tipoCambio)).toLocaleString('es-AR')} ARS
            </p>
          )}
        </div>

        {/* Quién pagó */}
        <div className="flux-card space-y-4">
          <h2 className="text-sm font-medium text-flux-text1 border-b border-flux-border pb-3">
            Pagador y medio de pago
          </h2>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-2">
              ¿Quién pagó? * <span className="text-flux-text3 font-normal">(no confundir con quién cargó el gasto)</span>
            </label>
            <div className="flex gap-2">
              {SOCIOS.map(s => (
                <button key={s.uid} onClick={() => setPagadoPor(s.uid)}
                  className={cn(
                    'flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all',
                    form.pagadoPorUid === s.uid
                      ? 'border-flux-teal bg-flux-tealGlow'
                      : 'border-flux-border hover:border-flux-muted'
                  )}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-flux-bg"
                    style={{ backgroundColor: s.color }}>
                    {s.nombre.charAt(0)}
                  </div>
                  <span className={cn('text-xs font-medium',
                    form.pagadoPorUid === s.uid ? 'text-flux-teal' : 'text-flux-text2')}>
                    {s.nombre}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-2xs text-flux-text3 mt-2">
              Cargado por: <span className="text-flux-text2">{profile?.nombre ?? '—'}</span>
              {' '}(automático, no editable)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Medio de pago</label>
              <select className="flux-input" value={form.medioPagoId}
                onChange={e => setMedioPago(e.target.value)}>
                <option value="">Sin especificar</option>
                {medios.filter(m => m.activo).map(m => (
                  <option key={m.id} value={m.id}>{m.nombre} ({m.ownerNombre})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado del gasto</label>
              <select className="flux-input" value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value as GastoEstado }))}>
                <option value="paid">Pagado</option>
                <option value="pending_payment">Pendiente de pago</option>
                <option value="draft">Borrador</option>
                <option value="to_reimburse">A reintegrar</option>
              </select>
            </div>
          </div>
        </div>

        {/* Distribución entre socios */}
        <div className="flux-card space-y-4">
          <div className="flex items-center justify-between border-b border-flux-border pb-3">
            <h2 className="text-sm font-medium text-flux-text1 flex items-center gap-2">
              <Users size={14} className="text-flux-text3" /> Distribución entre socios
            </h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-flux-text3">Dividir entre socios</span>
              <button
                onClick={() => setForm(f => ({ ...f, distribuirEntreSocios: !f.distribuirEntreSocios }))}
                className={cn('w-9 h-5 rounded-full transition-all relative',
                  form.distribuirEntreSocios ? 'bg-flux-teal' : 'bg-flux-muted')}>
                <div className={cn('w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all',
                  form.distribuirEntreSocios ? 'left-5' : 'left-0.5')} />
              </button>
            </label>
          </div>

          {form.distribuirEntreSocios && (
            <>
              <div className="space-y-3">
                {distribucion.map((d, i) => {
                  const socio = SOCIOS.find(s => s.uid === d.uid)
                  return (
                    <div key={d.uid} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-28 shrink-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-flux-bg"
                          style={{ backgroundColor: socio?.color }}>
                          {d.nombre.charAt(0)}
                        </div>
                        <span className="text-sm text-flux-text1">{d.nombre}</span>
                      </div>
                      <input type="number" min="0" max="100" step="0.01"
                        className="flux-input w-24 text-center"
                        value={d.porcentaje}
                        onChange={e => updatePorcentaje(d.uid, parseFloat(e.target.value) || 0)} />
                      <span className="text-xs text-flux-text3">%</span>
                      <span className="text-sm font-medium text-flux-teal ml-auto">
                        $ {d.monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )
                })}
              </div>

              {!distOk && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 border border-amber-800/30 rounded-lg px-3 py-2">
                  <AlertCircle size={12} />
                  Los porcentajes suman {totalDist.toFixed(1)}% — deben sumar exactamente 100%
                </div>
              )}

              <button
                onClick={() => setDistribucion(prev => prev.map(d => ({
                  ...d,
                  porcentaje: 33.33,
                  monto: (parseFloat(form.importe) || 0) * 0.3333,
                })))}
                className="btn-ghost text-xs py-1.5">
                Dividir en partes iguales
              </button>
            </>
          )}
        </div>

        {/* Opcionales */}
        <div className="flux-card space-y-4">
          <h2 className="text-sm font-medium text-flux-text1 border-b border-flux-border pb-3">
            Datos opcionales
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Cliente asociado</label>
              <input className="flux-input" placeholder="Nombre del cliente"
                value={form.clienteNombre}
                onChange={e => setForm(f => ({ ...f, clienteNombre: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Proyecto asociado</label>
              <input className="flux-input" placeholder="Nombre del proyecto"
                value={form.proyectoNombre}
                onChange={e => setForm(f => ({ ...f, proyectoNombre: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Observaciones</label>
            <textarea rows={3} className="flux-input resize-none text-sm"
              placeholder="Notas internas, contexto, aclaraciones…"
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">
              Tags <span className="font-normal text-flux-text3">(separados por coma)</span>
            </label>
            <input className="flux-input" placeholder="infraestructura, mensual, urgente"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded"
              checked={form.esReintegrable}
              onChange={e => setForm(f => ({ ...f, esReintegrable: e.target.checked }))} />
            <span className="text-sm text-flux-text2">Este gasto es reintegrable</span>
          </label>
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Link href="/admin/gastos" className="btn-ghost">Cancelar</Link>
          <button onClick={handleSubmit} disabled={saving}
            className="btn-primary flex items-center gap-2">
            {saving ? <><Spinner size={14} /> Guardando…</> : <><Save size={14} /> Guardar gasto</>}
          </button>
        </div>
      </div>
    </div>
  )
}
