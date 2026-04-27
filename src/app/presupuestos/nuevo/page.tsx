'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter }           from 'next/navigation'
import { useAuthContext }      from '@/components/auth/AuthProvider'
import { PageHeader }          from '@/components/layout/PageHeader'
import { Spinner }             from '@/components/ui'
import { db }                  from '@/lib/firebase/config'
import {
  collection, addDoc, getDocs,
  serverTimestamp, query, orderBy, doc, getDoc,
} from 'firebase/firestore'
import type { PresupuestoItem } from '@/types/presupuestos'
import {
  TARIFAS_DEFAULT, CONDICIONES_DEFAULT,
} from '@/types/presupuestos'
import { cn }                  from '@/lib/utils'
import { nanoid }              from 'nanoid'
import {
  ArrowLeft, Plus, Trash2, Save,
  Send, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, Zap,
} from 'lucide-react'
import Link from 'next/link'

// ── Counter helper ────────────────────────────────────────
async function getNextPresupuestoNum(): Promise<string> {
  try {
    const ref = doc(db, '_counters', 'presupuestos')
    const snap = await getDoc(ref)
    const current = snap.exists() ? (snap.data()?.count ?? 0) : 0
    const next = current + 1
    const { updateDoc, setDoc } = await import('firebase/firestore')
    if (snap.exists()) await updateDoc(ref, { count: next })
    else               await setDoc(ref, { count: next })
    return `PRES-${String(next).padStart(4, '0')}`
  } catch {
    return `PRES-${Date.now().toString().slice(-4)}`
  }
}

// ── Item row ──────────────────────────────────────────────
function ItemRow({
  item, index, tarifas, onChange, onDelete,
}: {
  item:     PresupuestoItem
  index:    number
  tarifas:  typeof TARIFAS_DEFAULT
  onChange: (id: string, field: keyof PresupuestoItem, val: string | number) => void
  onDelete: (id: string) => void
}) {
  return (
    <tr className="border-b border-flux-border/50">
      <td className="px-3 py-2 text-xs text-flux-text3 w-8">{index + 1}</td>
      <td className="px-2 py-2">
        <div className="flex flex-col gap-1">
          <input className="flux-input text-sm py-1.5"
            placeholder="Descripción del ítem o tarea…"
            value={item.descripcion}
            onChange={e => onChange(item.id, 'descripcion', e.target.value)} />
          <div className="flex gap-2 items-center">
            <select className="flux-input text-xs py-1 flex-1"
              onChange={e => {
                const tarifa = tarifas.find(t => t.perfil === e.target.value)
                if (tarifa) onChange(item.id, 'valorHora', tarifa.valorHoraARS)
              }}>
              <option value="">↳ Usar tarifa predefinida…</option>
              {tarifas.map(t => (
                <option key={t.perfil} value={t.perfil}>
                  {t.perfil} — ${t.valorHoraARS.toLocaleString('es-AR')}/h
                </option>
              ))}
            </select>
          </div>
        </div>
      </td>
      <td className="px-2 py-2 w-24">
        <input type="number" min="0" step="0.5" className="flux-input text-sm py-1.5 text-center"
          value={item.horas || ''}
          placeholder="0"
          onChange={e => onChange(item.id, 'horas', parseFloat(e.target.value) || 0)} />
      </td>
      <td className="px-2 py-2 w-32">
        <input type="number" min="0" step="100" className="flux-input text-sm py-1.5 text-right"
          value={item.valorHora || ''}
          placeholder="0"
          onChange={e => onChange(item.id, 'valorHora', parseFloat(e.target.value) || 0)} />
      </td>
      <td className="px-2 py-2 w-32 text-right">
        <p className="text-sm font-medium text-flux-teal pr-2">
          {item.subtotal > 0 ? `$${item.subtotal.toLocaleString('es-AR')}` : '—'}
        </p>
      </td>
      <td className="px-2 py-2 w-8">
        <button onClick={() => onDelete(item.id)}
          className="p-1 text-flux-text3 hover:text-flux-danger transition-colors">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function NuevoPresupuestoPage() {
  const router        = useRouter()
  const { user, profile } = useAuthContext()

  const [numero,      setNumero]      = useState('')
  const [saving,      setSaving]      = useState(false)
  const [sending,     setSending]     = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [errorMsg,    setErrorMsg]    = useState('')
  const [showConds,   setShowConds]   = useState(false)
  const [tarifas,     setTarifas]     = useState(TARIFAS_DEFAULT)
  const [clientes,    setClientes]    = useState<{id: string; nombre: string; email: string; empresa: string; telefono: string}[]>([])

  const [form, setForm] = useState({
    clienteId:     '',
    clienteNombre: '',
    clienteEmail:  '',
    clienteTel:    '',
    empresa:       '',
    moneda:        'ARS' as 'ARS' | 'USD',
    iva:           21,
    descuento:     0,
    validezDias:   15,
    notas:         '',
    condiciones:   CONDICIONES_DEFAULT,
  })

  const [items, setItems] = useState<PresupuestoItem[]>([
    { id: nanoid(6), descripcion: '', horas: 0, valorHora: 0, subtotal: 0, notas: '' },
  ])

  // Load numero and data
  useEffect(() => {
    getNextPresupuestoNum().then(setNumero)

    // Load tarifas from Firestore if exist
    getDocs(collection(db, 'presupuestoTarifas')).then(snap => {
      if (!snap.empty) {
        setTarifas(snap.docs.map(d => d.data() as typeof TARIFAS_DEFAULT[0]))
      }
    }).catch(() => {})

    // Load clients
    getDocs(query(collection(db, 'clientes'), orderBy('nombre'))).then(snap => {
      setClientes(snap.docs.map(d => {
        const data = d.data() as any
        return {
          id:       d.id,
          nombre:   data.nombre ?? '',
          email:    data.email  ?? '',
          empresa:  data.empresa ?? '',
          telefono: data.telefono ?? '',
        }
      }))
    }).catch(() => {})
  }, [])

  // Item operations
  function addItem() {
    setItems(prev => [...prev, {
      id: nanoid(6), descripcion: '', horas: 0, valorHora: 0, subtotal: 0, notas: '',
    }])
  }

  function updateItem(id: string, field: keyof PresupuestoItem, val: string | number) {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const updated = { ...item, [field]: val }
      updated.subtotal = updated.horas * updated.valorHora
      return updated
    }))
  }

  function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function selectCliente(id: string) {
    const c = clientes.find(cl => cl.id === id)
    if (!c) return
    setForm(f => ({
      ...f,
      clienteId:     c.id,
      clienteNombre: c.nombre,
      clienteEmail:  c.email,
      clienteTel:    c.telefono,
      empresa:       c.empresa,
    }))
  }

  // Calculations
  const subtotalItems = items.reduce((acc, i) => acc + i.subtotal, 0)
  const descuentoMonto = subtotalItems * (form.descuento / 100)
  const baseConDesc    = subtotalItems - descuentoMonto
  const ivaMonto       = baseConDesc * (form.iva / 100)
  const total          = baseConDesc + ivaMonto

  // Total horas
  const totalHoras = items.reduce((acc, i) => acc + i.horas, 0)

  function validate() {
    if (!form.clienteNombre.trim()) { setErrorMsg('El nombre del cliente es obligatorio'); return false }
    if (!form.clienteEmail.trim())  { setErrorMsg('El email del cliente es obligatorio'); return false }
    if (items.every(i => !i.descripcion.trim())) { setErrorMsg('Agregá al menos un ítem'); return false }
    return true
  }

  async function save(estado: 'borrador' | 'enviado' = 'borrador') {
    if (!user || !profile) return
    if (!validate()) return

    if (estado === 'borrador') setSaving(true)
    else setSending(true)
    setErrorMsg('')

    try {
      const data = {
        numero,
        clienteId:      form.clienteId     || null,
        clienteNombre:  form.clienteNombre.trim(),
        clienteEmail:   form.clienteEmail.trim(),
        clienteTel:     form.clienteTel.trim()    || null,
        empresa:        form.empresa.trim()        || null,
        items:          items.filter(i => i.descripcion.trim()),
        subtotal:       subtotalItems,
        iva:            form.iva,
        ivaMonto,
        descuento:      form.descuento,
        descuentoMonto,
        total,
        totalHoras,
        moneda:         form.moneda,
        validezDias:    form.validezDias,
        estado,
        notas:          form.notas.trim() || null,
        condiciones:    form.condiciones,
        creadoPorUid:   user.uid,
        creadoPorNombre: profile.nombre || '',
        creadoEn:       serverTimestamp(),
        actualizadoEn:  serverTimestamp(),
        ...(estado === 'enviado' && { enviadoEn: serverTimestamp() }),
      }

      const ref = await addDoc(collection(db, 'presupuestos'), data)

      // If sending — trigger email via Gmail API
      if (estado === 'enviado' && form.clienteEmail) {
        await sendPresupuestoEmail(ref.id, data)
      }

      setSaved(true)
      setTimeout(() => router.push(`/presupuestos/${ref.id}`), 1200)
    } catch (err: any) {
      console.error('Error saving presupuesto:', err)
      setErrorMsg(err?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
      setSending(false)
    }
  }

  async function sendPresupuestoEmail(presupuestoId: string, data: any) {
    if (!user) return
    try {
      // Get Google token
      const tokenSnap = await getDoc(doc(db, 'googleTokens', user.uid))
      if (!tokenSnap.exists()) return  // no token — skip silently

      const tokens = tokenSnap.data()

      const body = `Hola ${data.clienteNombre.split(' ')[0]},

Adjunto encontrarás el presupuesto ${data.numero} de Fluxtic.

📋 Resumen:
${data.items.map((i: PresupuestoItem) => `  • ${i.descripcion}: ${i.horas}h × $${i.valorHora.toLocaleString('es-AR')}/h = $${i.subtotal.toLocaleString('es-AR')}`).join('\n')}

💰 Total: $${data.total.toLocaleString('es-AR')} (IVA incluido)
⏱️ Horas estimadas: ${data.totalHoras}h
✅ Válido por: ${data.validezDias} días

${data.condiciones}

---
Para aceptar o consultar, respondé este email o escribinos a info@fluxtic.com

Saludos,
${data.creadoPorNombre}
Fluxtic — Automatizaciones Inteligentes
`
      await fetch('/api/gmail/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date:   tokens.expiry_date,
          to:      data.clienteEmail,
          subject: `Presupuesto ${data.numero} — Fluxtic`,
          body,
        }),
      })
    } catch (err) {
      console.error('Email send error (non-fatal):', err)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Nuevo presupuesto · ${numero}`}
        subtitle="Estimación por horas"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/presupuestos" className="btn-ghost flex items-center gap-2 text-sm">
              <ArrowLeft size={14} /> Volver
            </Link>
            <button onClick={() => save('borrador')} disabled={saving || saved}
              className="btn-ghost flex items-center gap-2 text-sm">
              {saving ? <Spinner size={14} /> : <Save size={14} />}
              Guardar borrador
            </button>
            <button onClick={() => save('enviado')} disabled={sending || saved}
              className="btn-primary flex items-center gap-2 text-sm">
              {saved     ? <><CheckCircle size={14} /> Listo</>
               : sending ? <><Spinner size={14} /> Enviando…</>
               : <><Send size={14} /> Guardar y enviar</>}
            </button>
          </div>
        }
      />

      <div className="px-4 md:px-8 pb-10 space-y-5 pt-2">

        {errorMsg && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm text-red-300"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertCircle size={15} className="shrink-0 mt-0.5" /> {errorMsg}
          </div>
        )}

        {/* Datos del cliente */}
        <div className="flux-card space-y-4">
          <h2 className="text-sm font-semibold text-flux-text1 pb-3 border-b border-flux-border">
            Cliente
          </h2>

          {clientes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">
                Seleccionar cliente existente
              </label>
              <select className="flux-input"
                value={form.clienteId}
                onChange={e => selectCliente(e.target.value)}>
                <option value="">— O completá manualmente ↓ —</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} — {c.empresa}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Nombre *</label>
              <input className="flux-input" placeholder="Juan Pérez"
                value={form.clienteNombre}
                onChange={e => setForm(f => ({ ...f, clienteNombre: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Empresa</label>
              <input className="flux-input" placeholder="Mi Empresa S.A."
                value={form.empresa}
                onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Email *</label>
              <input type="email" className="flux-input" placeholder="juan@empresa.com"
                value={form.clienteEmail}
                onChange={e => setForm(f => ({ ...f, clienteEmail: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Teléfono</label>
              <input className="flux-input" placeholder="+54 9 343 123 4567"
                value={form.clienteTel}
                onChange={e => setForm(f => ({ ...f, clienteTel: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Items — tabla de horas */}
        <div className="flux-card space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-flux-border">
            <div>
              <h2 className="text-sm font-semibold text-flux-text1">Ítems y horas</h2>
              <p className="text-2xs text-flux-text3 mt-0.5">
                Total: <span className="text-flux-teal font-medium">{totalHoras}h</span>
              </p>
            </div>
            <button onClick={addItem} className="btn-ghost flex items-center gap-1.5 text-xs py-1.5">
              <Plus size={13} /> Agregar ítem
            </button>
          </div>

          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-flux-border">
                  <th className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-3 py-2 w-8">#</th>
                  <th className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-2 py-2">Descripción</th>
                  <th className="text-center text-2xs font-medium text-flux-text3 uppercase tracking-widest px-2 py-2 w-24">Horas</th>
                  <th className="text-right text-2xs font-medium text-flux-text3 uppercase tracking-widest px-2 py-2 w-32">Valor/hora</th>
                  <th className="text-right text-2xs font-medium text-flux-text3 uppercase tracking-widest px-2 py-2 w-32">Subtotal</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <ItemRow key={item.id} item={item} index={i}
                    tarifas={tarifas}
                    onChange={updateItem}
                    onDelete={deleteItem} />
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addItem}
            className="w-full border border-dashed border-flux-border rounded-xl py-3 text-xs text-flux-text3 hover:border-flux-teal hover:text-flux-teal transition-all flex items-center justify-center gap-2">
            <Plus size={13} /> Agregar ítem
          </button>
        </div>

        {/* Totales */}
        <div className="flux-card">
          <h2 className="text-sm font-semibold text-flux-text1 pb-3 border-b border-flux-border mb-4">
            Totales
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

            {/* Left — config */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Moneda</label>
                  <select className="flux-input" value={form.moneda}
                    onChange={e => setForm(f => ({ ...f, moneda: e.target.value as 'ARS' | 'USD' }))}>
                    <option value="ARS">ARS $</option>
                    <option value="USD">USD $</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">IVA %</label>
                  <input type="number" min="0" max="100" className="flux-input"
                    value={form.iva} onChange={e => setForm(f => ({ ...f, iva: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Descuento %</label>
                  <input type="number" min="0" max="100" className="flux-input"
                    value={form.descuento} onChange={e => setForm(f => ({ ...f, descuento: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Validez (días)</label>
                <input type="number" min="1" className="flux-input w-32"
                  value={form.validezDias} onChange={e => setForm(f => ({ ...f, validezDias: parseInt(e.target.value) || 15 }))} />
              </div>
            </div>

            {/* Right — summary */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-flux-border/50">
                <span className="text-flux-text3">Subtotal</span>
                <span className="font-medium text-flux-text1">${subtotalItems.toLocaleString('es-AR')}</span>
              </div>
              {form.descuento > 0 && (
                <div className="flex justify-between py-1.5 border-b border-flux-border/50 text-green-400">
                  <span>Descuento ({form.descuento}%)</span>
                  <span>- ${descuentoMonto.toLocaleString('es-AR')}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-flux-border/50">
                <span className="text-flux-text3">IVA ({form.iva}%)</span>
                <span className="font-medium text-flux-text1">${ivaMonto.toLocaleString('es-AR')}</span>
              </div>
              <div className="flex justify-between py-3 bg-flux-tealGlow rounded-xl px-4 mt-2">
                <span className="font-bold text-flux-teal text-base">TOTAL</span>
                <span className="font-black text-flux-teal text-xl">
                  {form.moneda === 'USD' ? 'USD ' : '$'}{total.toLocaleString('es-AR')}
                </span>
              </div>
              <p className="text-2xs text-flux-text3 text-right">
                {totalHoras}h estimadas · {totalHoras > 0 ? `$${Math.round(total / totalHoras).toLocaleString('es-AR')}/h efectivo` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Notas y condiciones */}
        <div className="flux-card space-y-4">
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Notas internas</label>
            <textarea rows={2} className="flux-input resize-none text-sm"
              placeholder="Notas para el equipo (no se envían al cliente)…"
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>

          <div>
            <button onClick={() => setShowConds(s => !s)}
              className="flex items-center gap-2 text-xs text-flux-text3 hover:text-flux-text1 transition-colors mb-2">
              {showConds ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Condiciones comerciales
            </button>
            {showConds && (
              <textarea rows={5} className="flux-input resize-none text-xs"
                value={form.condiciones}
                onChange={e => setForm(f => ({ ...f, condiciones: e.target.value }))} />
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pb-4">
          <Link href="/presupuestos" className="btn-ghost">Cancelar</Link>
          <button onClick={() => save('borrador')} disabled={saving || saved}
            className="btn-ghost flex items-center gap-2">
            {saving ? <Spinner size={14} /> : <Save size={14} />}
            Guardar borrador
          </button>
          <button onClick={() => save('enviado')} disabled={sending || saved}
            className="btn-primary flex items-center gap-2">
            {saved     ? <><CheckCircle size={14} /> ¡Listo!</>
             : sending ? <><Spinner size={14} /> Enviando…</>
             : <><Send size={14} /> Guardar y enviar por email</>}
          </button>
        </div>
      </div>
    </div>
  )
}
