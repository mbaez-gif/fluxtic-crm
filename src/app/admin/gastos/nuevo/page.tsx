'use client'

import { useState, useEffect }  from 'react'
import { useRouter }            from 'next/navigation'
import { useAuthContext }       from '@/components/auth/AuthProvider'
import { PageHeader }           from '@/components/layout/PageHeader'
import { Spinner }              from '@/components/ui'
import { db }                   from '@/lib/firebase/config'
import {
  collection, addDoc, getDocs,
  serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { SOCIOS }               from '@/types/admin'
import { cn }                   from '@/lib/utils'
import { format }               from 'date-fns'
import {
  ArrowLeft, Save, AlertCircle,
  CheckCircle, Users,
} from 'lucide-react'
import Link from 'next/link'

// ── Helpers ───────────────────────────────────────────────
function getPeriodo() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Eliminamos cualquier undefined antes de enviar a Firestore
function cleanForFirestore(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    clean[k] = v === undefined ? null : v
  }
  return clean
}

const TIPOS_GASTO = [
  { value: 'fixed',     label: 'Fijo mensual'        },
  { value: 'operating', label: 'Operativo'            },
  { value: 'cogs',      label: 'Costo de servicio'   },
  { value: 'marketing', label: 'Marketing'            },
  { value: 'salary',    label: 'Sueldo / Honorario'  },
  { value: 'tax',       label: 'Impuesto / Tasa'     },
  { value: 'other',     label: 'Otro'                },
]

const MONEDAS = [
  { value: 'ARS', label: 'ARS $' },
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
]

export default function NuevoGastoPage() {
  const router        = useRouter()
  const { user, profile } = useAuthContext()

  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [categorias,  setCategorias]  = useState<{id: string; nombre: string}[]>([])
  const [medios,      setMedios]      = useState<{id: string; nombre: string; ownerNombre: string}[]>([])
  const [provSuggs,   setProvSuggs]   = useState<{id: string; nombre: string}[]>([])
  const [provSearch,  setProvSearch]  = useState('')

  const [distribucion, setDistribucion] = useState(
    SOCIOS.filter(s => !s.uid.includes('_UID')).map(s => ({
      uid:        s.uid,
      nombre:     s.nombre,
      color:      s.color,
      porcentaje: 33.33,
      monto:      0,
    }))
  )

  const [form, setForm] = useState({
    fecha:           format(new Date(), 'yyyy-MM-dd'),
    periodo:         getPeriodo(),
    proveedorId:     '',
    proveedorNombre: '',
    descripcion:     '',
    categoriaId:     '',
    categoriaNombre: '',
    tipo:            'operating',
    importe:         '',
    moneda:          'ARS',
    tipoCambio:      '',
    medioPagoId:     '',
    medioPagoNombre: '',
    pagadoPorUid:    '',
    pagadoPorNombre: '',
    estado:          'paid',
    clienteNombre:   '',
    proyectoNombre:  '',
    distribuir:      true,
    notas:           '',
    tags:            '',
  })

  // Cargar categorías y medios de pago
  useEffect(() => {
    async function load() {
      try {
        const catSnap = await getDocs(query(collection(db, 'adminCategorias'), orderBy('nombre')))
        if (catSnap.empty) {
          // Seed categorías por defecto
          const defaults = [
            'Software y suscripciones', 'Infraestructura y hosting',
            'Marketing y publicidad', 'Honorarios y sueldos',
            'Impuestos y tasas', 'Servicios públicos',
            'Oficina y materiales', 'Viáticos y transporte', 'Otros',
          ]
          for (const nombre of defaults) {
            await addDoc(collection(db, 'adminCategorias'), {
              nombre, activa: true, creadoEn: serverTimestamp()
            })
          }
          const newSnap = await getDocs(query(collection(db, 'adminCategorias'), orderBy('nombre')))
          setCategorias(newSnap.docs.map(d => ({ id: d.id, nombre: (d.data() as any).nombre })))
        } else {
          setCategorias(catSnap.docs.map(d => ({ id: d.id, nombre: (d.data() as any).nombre })))
        }
      } catch (err) {
        console.error('Error loading categorias:', err)
      }

      try {
        const medSnap = await getDocs(collection(db, 'adminMediosPago'))
        setMedios(medSnap.docs.map(d => {
          const data = d.data() as any
          return { id: d.id, nombre: data.nombre, ownerNombre: data.ownerNombre ?? '' }
        }))
      } catch (err) {
        console.error('Error loading medios:', err)
      }
    }
    load()
  }, [])

  // Set pagador por defecto al usuario actual
  useEffect(() => {
    if (!user || !profile) return
    setForm(f => ({
      ...f,
      pagadoPorUid:    user.uid,
      pagadoPorNombre: profile.nombre ?? '',
    }))
  }, [user, profile])

  // Recalcular distribución
  useEffect(() => {
    const monto = parseFloat(form.importe) || 0
    setDistribucion(prev => prev.map(d => ({
      ...d,
      monto: (monto * d.porcentaje) / 100,
    })))
  }, [form.importe])

  async function searchProveedores(term: string) {
    setProvSearch(term)
    setForm(f => ({ ...f, proveedorNombre: term, proveedorId: '' }))
    if (term.length < 2) { setProvSuggs([]); return }
    try {
      const snap = await getDocs(collection(db, 'adminProveedores'))
      const results = snap.docs
        .map(d => ({ id: d.id, nombre: (d.data() as any).nombre ?? '' }))
        .filter(p => p.nombre.toLowerCase().includes(term.toLowerCase()))
        .slice(0, 6)
      setProvSuggs(results)
    } catch { setProvSuggs([]) }
  }

  function selectProveedor(p: { id: string; nombre: string }) {
    setForm(f => ({ ...f, proveedorId: p.id, proveedorNombre: p.nombre }))
    setProvSearch(p.nombre)
    setProvSuggs([])
  }

  function updatePorcentaje(uid: string, pct: number) {
    const monto = parseFloat(form.importe) || 0
    setDistribucion(prev => prev.map(d =>
      d.uid === uid ? { ...d, porcentaje: pct, monto: (monto * pct) / 100 } : d
    ))
  }

  async function handleSubmit() {
    if (!user || !profile) return
    setErrorMsg('')

    const missing: string[] = []
    if (!form.proveedorNombre.trim()) missing.push('proveedor')
    if (!form.descripcion.trim())     missing.push('descripción')
    if (!form.importe)                missing.push('importe')

    if (missing.length) {
      setErrorMsg(`Campos obligatorios: ${missing.join(', ')}`)
      return
    }

    const monto = parseFloat(form.importe)
    if (isNaN(monto) || monto <= 0) {
      setErrorMsg('El importe debe ser mayor a 0')
      return
    }

    if (form.distribuir) {
      const total = distribucion.reduce((a, d) => a + d.porcentaje, 0)
      if (Math.abs(total - 100) > 0.5) {
        setErrorMsg(`Los porcentajes suman ${total.toFixed(1)}% — deben sumar 100%`)
        return
      }
    }

    setSaving(true)
    try {
      const tc = form.tipoCambio ? parseFloat(form.tipoCambio) : null

      // ⚠️ CRÍTICO: ningún campo puede ser undefined — Firestore lo rechaza
      // Usamos null o '' para todos los opcionales
      const data = cleanForFirestore({
        fecha:            form.fecha,
        periodo:          form.periodo,
        descripcion:      form.descripcion.trim(),
        tipo:             form.tipo,
        importe:          monto,
        moneda:           form.moneda,
        tipoCambio:       tc,
        importeARS:       (form.moneda !== 'ARS' && tc) ? monto * tc : null,
        // Proveedor — puede estar vacío si es nuevo
        proveedorId:      form.proveedorId || null,
        proveedorNombre:  form.proveedorNombre.trim(),
        // Categoría — opcional
        categoriaId:      form.categoriaId || null,
        categoriaNombre:  form.categoriaNombre || 'Sin categoría',
        // Pagador
        pagadoPorUid:     form.pagadoPorUid    || user.uid,
        pagadoPorNombre:  form.pagadoPorNombre || profile.nombre || '',
        // Medio de pago — opcional
        medioPagoId:      form.medioPagoId     || null,
        medioPagoNombre:  form.medioPagoNombre || null,
        // Opcionales de negocio
        clienteNombre:    form.clienteNombre.trim()   || null,
        proyectoNombre:   form.proyectoNombre.trim()  || null,
        notas:            form.notas.trim()            || null,
        tags:             form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        // Metadatos
        cargadoPorUid:    user.uid,
        cargadoPorNombre: profile.nombre || '',
        estado:           form.estado,
        tieneComprobante: false,
        esReintegrable:   false,
        esRecurrente:     false,
        incluidoEnCierre: false,
        fuente:           'manual',
        // Distribución
        distribuirEntreSocios: form.distribuir,
        distribucion: form.distribuir
          ? distribucion.map(d => ({
              uid:        d.uid,
              nombre:     d.nombre,
              porcentaje: d.porcentaje,
              monto:      d.monto,
              moneda:     form.moneda,
              pagado:     false,
            }))
          : null,
        creadoEn:      serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })

      await addDoc(collection(db, 'adminGastos'), data)

      setSaved(true)
      setTimeout(() => router.push('/admin/gastos'), 1200)
    } catch (err: any) {
      console.error('Error saving gasto:', err)
      setErrorMsg(err?.message ?? 'Error al guardar. Revisá la consola.')
    } finally {
      setSaving(false)
    }
  }

  const totalDist = distribucion.reduce((a, d) => a + d.porcentaje, 0)
  const distOk    = Math.abs(totalDist - 100) < 0.5

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
            <button onClick={handleSubmit} disabled={saving || saved}
              className="btn-primary flex items-center gap-2 text-sm">
              {saved  ? <><CheckCircle size={14} /> ¡Guardado!</>
               : saving ? <><Spinner size={14} /> Guardando…</>
               : <><Save size={14} /> Guardar gasto</>}
            </button>
          </div>
        }
      />

      <div className="px-4 md:px-8 pb-10 max-w-2xl space-y-5 pt-2">

        {errorMsg && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertCircle size={15} className="shrink-0 mt-0.5" /> {errorMsg}
          </div>
        )}

        {/* Datos principales */}
        <div className="flux-card space-y-4">
          <h2 className="text-sm font-semibold text-flux-text1 pb-3 border-b border-flux-border">Datos del gasto</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Fecha *</label>
              <input type="date" className="flux-input"
                value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Período *</label>
              <input type="month" className="flux-input"
                value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} />
            </div>
          </div>

          {/* Proveedor con autocomplete */}
          <div className="relative">
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Proveedor *</label>
            <input className="flux-input" placeholder="Escribí el nombre del proveedor…"
              value={provSearch || form.proveedorNombre}
              onChange={e => searchProveedores(e.target.value)} />
            {provSuggs.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover mt-1 overflow-hidden">
                {provSuggs.map(p => (
                  <button key={p.id} onClick={() => selectProveedor(p)}
                    className="w-full text-left px-4 py-2.5 text-sm text-flux-text1 hover:bg-flux-muted transition-colors">
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
            {form.proveedorId && (
              <p className="text-2xs text-flux-teal mt-1">✓ Proveedor existente seleccionado</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Descripción *</label>
            <input className="flux-input" placeholder="Ej: Suscripción mensual ChatGPT Plus — Abril 2026"
              value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Categoría</label>
              <select className="flux-input" value={form.categoriaId}
                onChange={e => {
                  const cat = categorias.find(c => c.id === e.target.value)
                  setForm(f => ({
                    ...f,
                    categoriaId:     e.target.value,
                    categoriaNombre: cat?.nombre ?? '',
                  }))
                }}>
                <option value="">Sin categoría</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Tipo de gasto</label>
              <select className="flux-input" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS_GASTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Montos */}
        <div className="flux-card space-y-4">
          <h2 className="text-sm font-semibold text-flux-text1 pb-3 border-b border-flux-border">Montos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Importe *</label>
              <input type="number" min="0" step="0.01" className="flux-input"
                placeholder="0.00" value={form.importe}
                onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Moneda</label>
              <select className="flux-input" value={form.moneda}
                onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                {MONEDAS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          {form.moneda !== 'ARS' && (
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Tipo de cambio (a ARS)</label>
              <input type="number" min="0" step="0.01" className="flux-input w-40"
                placeholder="1300" value={form.tipoCambio}
                onChange={e => setForm(f => ({ ...f, tipoCambio: e.target.value }))} />
              {form.tipoCambio && form.importe && (
                <p className="text-xs text-flux-text3 mt-1">
                  ≈ $ {(parseFloat(form.importe) * parseFloat(form.tipoCambio)).toLocaleString('es-AR')} ARS
                </p>
              )}
            </div>
          )}
        </div>

        {/* Pagador */}
        <div className="flux-card space-y-4">
          <h2 className="text-sm font-semibold text-flux-text1 pb-3 border-b border-flux-border">Pagador</h2>

          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-2">¿Quién pagó?</label>
            <div className="flex gap-2">
              {SOCIOS.filter(s => !s.uid.includes('_UID')).map(s => (
                <button key={s.uid} onClick={() => setForm(f => ({ ...f, pagadoPorUid: s.uid, pagadoPorNombre: s.nombre }))}
                  className={cn('flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all',
                    form.pagadoPorUid === s.uid
                      ? 'border-flux-teal bg-flux-tealGlow'
                      : 'border-flux-border hover:border-flux-muted')}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-flux-bg"
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Medio de pago</label>
              <select className="flux-input" value={form.medioPagoId}
                onChange={e => {
                  const m = medios.find(mp => mp.id === e.target.value)
                  setForm(f => ({ ...f, medioPagoId: e.target.value, medioPagoNombre: m?.nombre ?? '' }))
                }}>
                <option value="">Sin especificar</option>
                {medios.map(m => <option key={m.id} value={m.id}>{m.nombre} {m.ownerNombre ? `(${m.ownerNombre})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado</label>
              <select className="flux-input" value={form.estado}
                onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                <option value="paid">Pagado</option>
                <option value="pending_payment">Pendiente de pago</option>
                <option value="draft">Borrador</option>
                <option value="to_reimburse">A reintegrar</option>
              </select>
            </div>
          </div>
        </div>

        {/* Distribución */}
        <div className="flux-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-flux-border">
            <h2 className="text-sm font-semibold text-flux-text1 flex items-center gap-2">
              <Users size={14} className="text-flux-text3" /> Distribución entre socios
            </h2>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-flux-text3">Dividir</span>
              <button onClick={() => setForm(f => ({ ...f, distribuir: !f.distribuir }))}
                className={cn('w-9 h-5 rounded-full transition-all relative', form.distribuir ? 'bg-flux-teal' : 'bg-flux-muted')}>
                <div className={cn('w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all',
                  form.distribuir ? 'left-5' : 'left-0.5')} />
              </button>
            </label>
          </div>

          {form.distribuir && (
            <>
              <div className="space-y-3">
                {distribucion.map(d => (
                  <div key={d.uid} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-24 shrink-0">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-flux-bg"
                        style={{ backgroundColor: d.color }}>
                        {d.nombre.charAt(0)}
                      </div>
                      <span className="text-sm text-flux-text1">{d.nombre}</span>
                    </div>
                    <input type="number" min="0" max="100" step="0.01"
                      className="flux-input w-20 text-center"
                      value={d.porcentaje}
                      onChange={e => updatePorcentaje(d.uid, parseFloat(e.target.value) || 0)} />
                    <span className="text-xs text-flux-text3">%</span>
                    <span className="text-sm font-medium text-flux-teal ml-auto">
                      ${d.monto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
              </div>

              {!distOk && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 border border-amber-800/30 rounded-lg px-3 py-2">
                  <AlertCircle size={12} />
                  Suman {totalDist.toFixed(1)}% — deben ser 100%
                </div>
              )}

              <button onClick={() => {
                const pct   = parseFloat((100 / distribucion.length).toFixed(2))
                const monto = parseFloat(form.importe) || 0
                setDistribucion(prev => prev.map(d => ({ ...d, porcentaje: pct, monto: monto * pct / 100 })))
              }} className="btn-ghost text-xs py-1.5">
                Dividir en partes iguales
              </button>
            </>
          )}
        </div>

        {/* Opcionales */}
        <div className="flux-card space-y-4">
          <h2 className="text-sm font-semibold text-flux-text1 pb-3 border-b border-flux-border">Datos opcionales</h2>
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
              placeholder="Notas internas…"
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">
              Tags <span className="font-normal text-flux-text3">(separados por coma)</span>
            </label>
            <input className="flux-input" placeholder="infraestructura, mensual"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
          </div>
        </div>

        {/* Botones */}
        <div className="flex justify-end gap-3 pb-4">
          <Link href="/admin/gastos" className="btn-ghost">Cancelar</Link>
          <button onClick={handleSubmit} disabled={saving || saved}
            className="btn-primary flex items-center gap-2 min-w-[140px] justify-center">
            {saved  ? <><CheckCircle size={14} /> ¡Guardado!</>
             : saving ? <><Spinner size={14} /> Guardando…</>
             : <><Save size={14} /> Guardar gasto</>}
          </button>
        </div>
      </div>
    </div>
  )
}
