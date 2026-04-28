'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter }            from 'next/navigation'
import { useAuthContext }       from '@/components/auth/AuthProvider'
import { PageHeader }           from '@/components/layout/PageHeader'
import { Spinner }              from '@/components/ui'
import { db }                   from '@/lib/firebase/config'
import {
  collection, addDoc, getDocs,
  serverTimestamp, query, orderBy, doc, getDoc, updateDoc,
} from 'firebase/firestore'
import type {
  Presupuesto, PresupuestoItem, Etapa,
  ClientePresupuesto,
} from '@/types/presupuestos'
import {
  TIPOS_SERVICIO, ITEM_CATEGORIAS, ITEM_TIPO_LABEL,
  ETAPAS_DEFAULT, CONDICIONES_DEFAULT, DATOS_FLUXTIC,
  calcularItem, calcularTotales, formatMoney,
} from '@/types/presupuestos'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, ArrowRight, Save, Send, Plus,
  Trash2, CheckCircle, AlertCircle, Eye,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import Link from 'next/link'

// ── Unique ID helper ──────────────────────────────────────
let _counter = 0
function uid() { return `item_${Date.now()}_${_counter++}` }

// ── Steps ─────────────────────────────────────────────────
const STEPS = [
  { id: 'cliente',      label: 'Cliente'      },
  { id: 'general',      label: 'General'      },
  { id: 'alcance',      label: 'Alcance'      },
  { id: 'costos',       label: 'Costos'       },
  { id: 'condiciones',  label: 'Condiciones'  },
  { id: 'preview',      label: 'Vista previa' },
]

// ── Empty structures ──────────────────────────────────────
const emptyCliente: ClientePresupuesto = {
  razonSocial: '', contacto: '', cuitDni: '',
  email: '', telefono: '', direccion: '',
  localidad: '', provincia: '', rubro: '', observaciones: '',
}

function emptyItem(): PresupuestoItem {
  return {
    id: uid(), descripcion: '', categoria: 'Implementación',
    cantidad: 1, unidad: 'hora', precioUnit: 0, descuento: 0,
    subtotal: 0, tipo: 'unico', incluido: true,
  }
}

// ── Section heading ───────────────────────────────────────
function SH({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="pb-3 border-b border-flux-border mb-4">
      <h3 className="text-sm font-semibold text-flux-white">{title}</h3>
      {subtitle && <p className="text-2xs text-flux-text3 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Input wrapper ─────────────────────────────────────────
function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-flux-text2 mb-1.5">
        {label}{required && <span className="text-flux-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────
export default function NuevoPresupuestoPage() {
  const router = useRouter()
  const { user, profile } = useAuthContext()

  const [step,      setStep]      = useState(0)
  const [numero,    setNumero]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [errorMsg,  setErrorMsg]  = useState('')
  const [clientes,        setClientes]        = useState<any[]>([])
  const [leads,           setLeads]           = useState<any[]>([])
  const [clienteSelId,    setClienteSelId]    = useState('')
  const [autoFillActivo,  setAutoFillActivo]  = useState(false)
  const [camposEditables, setCamposEditables] = useState(true)

  // Form state
  const [cliente,    setCliente]    = useState<ClientePresupuesto>(emptyCliente)
  const [general,    setGeneral]    = useState({
    titulo:          '',
    tipoServicio:    '',
    fechaEmision:    new Date().toISOString().slice(0, 10),
    fechaVencimiento:'',
    validezDias:     30,
    responsable:     '',
    emailContacto:   DATOS_FLUXTIC.email,
    resumenEjecutivo: '',
    objetivo:        '',
    contexto:        '',
  })
  const [alcance, setAlcance] = useState({
    alcanceGeneral:  '',
    alcanceTecnico:  '',
    entregables:     '',
    fueraAlcance:    '',
    requisitos:      '',
    supuestos:       '',
    etapas:          ETAPAS_DEFAULT as Etapa[],
  })
  const [costos, setCostos] = useState({
    items:      [emptyItem()] as PresupuestoItem[],
    moneda:     'ARS' as 'ARS' | 'USD',
    incluyeIVA: false,
    tasaIVA:    21,
  })
  const [condiciones, setCondiciones] = useState({
    formaPago:              '50% al inicio — 50% a la entrega',
    condicionesComerciales: CONDICIONES_DEFAULT,
    notasInternas:          '',
  })

  // Load numero and clients
  useEffect(() => {
    fetch('/api/presupuestos/numero', { method: 'POST' })
      .then(r => r.json())
      .then(d => setNumero(d.numero))
      .catch(() => setNumero(`FLX-${new Date().getFullYear()}-0001`))

    if (profile?.nombre) setGeneral(g => ({ ...g, responsable: profile.nombre }))

    getDocs(query(collection(db, 'clientes'), orderBy('nombre'))).then(snap => {
      setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }).catch(() => {})

    getDocs(collection(db, 'leads')).then(snap => {
      setLeads(snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((l: any) => l.nombre && (l.estado === 'calificado' || l.estado === 'contactado'))
      )
    }).catch(() => {})
  }, [profile])

  // Auto-set vencimiento from validez
  useEffect(() => {
    if (general.fechaEmision && general.validezDias) {
      const d = new Date(general.fechaEmision)
      d.setDate(d.getDate() + general.validezDias)
      setGeneral(g => ({ ...g, fechaVencimiento: d.toISOString().slice(0, 10) }))
    }
  }, [general.fechaEmision, general.validezDias])

  // Item operations
  function addItem() {
    setCostos(c => ({ ...c, items: [...c.items, emptyItem()] }))
  }

  function updateItem(id: string, field: keyof PresupuestoItem, val: any) {
    setCostos(c => ({
      ...c,
      items: c.items.map(item => {
        if (item.id !== id) return item
        const updated = { ...item, [field]: val }
        return calcularItem(updated)
      }),
    }))
  }

  function removeItem(id: string) {
    setCostos(c => ({ ...c, items: c.items.filter(i => i.id !== id) }))
  }

  function updateEtapa(id: string, field: keyof Etapa, val: string) {
    setAlcance(a => ({
      ...a,
      etapas: a.etapas.map(e => e.id === id ? { ...e, [field]: val } : e),
    }))
  }

  // Select existing client or lead
  function selectExisting(sourceId: string, type: 'cliente' | 'lead') {
    if (!sourceId) {
      setClienteSelId('')
      setAutoFillActivo(false)
      setCamposEditables(true)
      return
    }
    const source = type === 'cliente'
      ? clientes.find(c => c.id === sourceId)
      : leads.find(l => l.id === sourceId)
    if (!source) return

    setClienteSelId(sourceId)
    setAutoFillActivo(true)

    setCliente(prev => ({
      ...prev,
      clienteId:    source.id,
      razonSocial:  source.empresa ?? source.nombre ?? '',
      contacto:     source.nombre  ?? '',
      email:        source.email   ?? '',
      telefono:     source.telefono ?? '',
      cuitDni:      source.cuitDni ?? source.taxId ?? '',
      direccion:    source.direccion ?? '',
      localidad:    source.localidad ?? '',
      provincia:    source.provincia ?? '',
      rubro:        source.rubro ?? source.actividad ?? '',
      observaciones: source.observaciones ?? source.notas ?? '',
    }))
  }

  function clearSelection() {
    setClienteSelId('')
    setAutoFillActivo(false)
    setCamposEditables(true)
    setCliente(prev => ({ ...prev, clienteId: undefined }))
  }

  // Totals
  const tots = calcularTotales(costos.items, costos.tasaIVA, costos.incluyeIVA)

  // Validation per step
  function validateStep(s: number): string | null {
    if (s === 0 && !cliente.razonSocial.trim()) return 'El nombre del cliente es obligatorio'
    if (s === 1) {
      if (!general.titulo.trim()) return 'El título de la propuesta es obligatorio'
      if (!general.tipoServicio) return 'Seleccioná el tipo de servicio'
      if (general.fechaVencimiento && general.fechaVencimiento <= general.fechaEmision)
        return 'La fecha de vencimiento debe ser posterior a la de emisión'
    }
    if (s === 3 && costos.items.every(i => !i.descripcion.trim()))
      return 'Agregá al menos un ítem de costo'
    return null
  }

  function nextStep() {
    const err = validateStep(step)
    if (err) { setErrorMsg(err); return }
    setErrorMsg('')
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  function prevStep() {
    setErrorMsg('')
    setStep(s => Math.max(s - 1, 0))
  }

  function buildPayload(estado: 'borrador' | 'enviado') {
    return {
      budgetNumber:    numero,
      estado,
      clienteData:     cliente,
      titulo:          general.titulo,
      tipoServicio:    general.tipoServicio,
      fechaEmision:    general.fechaEmision,
      fechaVencimiento: general.fechaVencimiento,
      validezDias:     general.validezDias,
      responsable:     general.responsable,
      emailContacto:   general.emailContacto,
      resumenEjecutivo: general.resumenEjecutivo,
      objetivo:        general.objetivo,
      contexto:        general.contexto,
      alcanceGeneral:  alcance.alcanceGeneral,
      alcanceTecnico:  alcance.alcanceTecnico,
      entregables:     alcance.entregables,
      fueraAlcance:    alcance.fueraAlcance,
      requisitos:      alcance.requisitos,
      supuestos:       alcance.supuestos,
      etapas:          alcance.etapas,
      items:           costos.items.filter(i => i.descripcion.trim()),
      moneda:          costos.moneda,
      incluyeIVA:      costos.incluyeIVA,
      tasaIVA:         costos.tasaIVA,
      ...tots,
      formaPago:       condiciones.formaPago,
      condicionesComerciales: condiciones.condicionesComerciales,
      notasInternas:   condiciones.notasInternas || null,
      creadoPorUid:    user?.uid ?? '',
      creadoPorNombre: profile?.nombre ?? '',
      creadoEn:        serverTimestamp(),
      actualizadoEn:   serverTimestamp(),
      ...(estado === 'enviado' && { enviadoEn: serverTimestamp() }),
    }
  }

  async function handleSave(estado: 'borrador' | 'enviado' = 'borrador') {
    const err = validateStep(0) || validateStep(1) || validateStep(3)
    if (err) { setErrorMsg(err); return }
    setSaving(true)
    setErrorMsg('')
    try {
      const ref = await addDoc(collection(db, 'budgets'), buildPayload(estado))
      router.push(`/presupuestos/${ref.id}`)
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // ── Render steps ─────────────────────────────────────────

  const renderStep = () => {
    switch (step) {

      // ── STEP 0: Cliente ──────────────────────────────────
      case 0: return (
        <div className="space-y-5">
          <SH title="Datos del cliente" />

          {/* ── Selector de cliente existente ── */}
          <div className="p-4 rounded-xl border border-flux-border bg-flux-surface space-y-4">
            <p className="text-xs font-semibold text-flux-text1">Seleccionar de clientes existentes</p>

            {/* Clientes */}
            {clientes.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">
                  Clientes del CRM
                </label>
                <select className="flux-input"
                  value={clienteSelId}
                  onChange={e => selectExisting(e.target.value, 'cliente')}>
                  <option value="">— Seleccionar cliente —</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.empresa ? `${c.empresa} · ${c.nombre}` : c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Leads calificados */}
            {leads.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">
                  Leads calificados / contactados
                </label>
                <select className="flux-input"
                  value={clienteSelId}
                  onChange={e => selectExisting(e.target.value, 'lead')}>
                  <option value="">— Seleccionar lead —</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>
                      [{(l as any).leadId ?? '—'}] {l.nombre} {l.empresa ? `· ${l.empresa}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Auto-fill status */}
            {autoFillActivo && (
              <div className="flex items-center justify-between bg-flux-tealGlow border border-flux-teal/20 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <CheckCircle size={13} className="text-flux-teal shrink-0" />
                  <p className="text-xs text-flux-teal font-medium">
                    Datos cargados automáticamente desde el CRM
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Toggle edición */}
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-flux-text3">
                    <button
                      type="button"
                      onClick={() => setCamposEditables(e => !e)}
                      className={cn(
                        'w-8 h-4 rounded-full transition-all relative shrink-0',
                        camposEditables ? 'bg-flux-teal' : 'bg-flux-muted'
                      )}
                    >
                      <div className={cn(
                        'w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all',
                        camposEditables ? 'left-4' : 'left-0.5'
                      )} />
                    </button>
                    Editar datos
                  </label>
                  {/* Clear */}
                  <button type="button" onClick={clearSelection}
                    className="text-flux-text3 hover:text-flux-danger transition-colors text-xs">
                    Limpiar
                  </button>
                </div>
              </div>
            )}

            {clientes.length === 0 && leads.length === 0 && (
              <p className="text-xs text-flux-text3 italic">
                No hay clientes ni leads calificados en el CRM todavía.
              </p>
            )}
          </div>

          {/* Separador */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-flux-border" />
            <span className="text-2xs text-flux-text3 font-medium uppercase tracking-wider">
              {autoFillActivo ? 'Datos del cliente seleccionado' : 'O completar manualmente'}
            </span>
            <div className="flex-1 border-t border-flux-border" />
          </div>

          {/* ── Formulario manual / edición ── */}
          <div className={cn(
            'grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity',
            !camposEditables && 'opacity-60 pointer-events-none select-none'
          )}>
            <Field label="Razón social / Nombre" required>
              <input className="flux-input" placeholder="Empresa S.A. o Juan Pérez"
                value={cliente.razonSocial}
                onChange={e => setCliente(c => ({ ...c, razonSocial: e.target.value }))} />
            </Field>
            <Field label="Nombre de contacto">
              <input className="flux-input" placeholder="Nombre del interlocutor"
                value={cliente.contacto}
                onChange={e => setCliente(c => ({ ...c, contacto: e.target.value }))} />
            </Field>
            <Field label="CUIT / DNI">
              <input className="flux-input" placeholder="20-12345678-9"
                value={cliente.cuitDni}
                onChange={e => setCliente(c => ({ ...c, cuitDni: e.target.value }))} />
            </Field>
            <Field label="Email">
              <input type="email" className="flux-input" placeholder="contacto@empresa.com"
                value={cliente.email}
                onChange={e => setCliente(c => ({ ...c, email: e.target.value }))} />
            </Field>
            <Field label="Teléfono">
              <input className="flux-input" placeholder="+54 9 11 1234 5678"
                value={cliente.telefono}
                onChange={e => setCliente(c => ({ ...c, telefono: e.target.value }))} />
            </Field>
            <Field label="Rubro / Actividad">
              <input className="flux-input" placeholder="Comercio, Salud, Tecnología…"
                value={cliente.rubro}
                onChange={e => setCliente(c => ({ ...c, rubro: e.target.value }))} />
            </Field>
            <Field label="Dirección">
              <input className="flux-input"
                value={cliente.direccion}
                onChange={e => setCliente(c => ({ ...c, direccion: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Localidad">
                <input className="flux-input"
                  value={cliente.localidad}
                  onChange={e => setCliente(c => ({ ...c, localidad: e.target.value }))} />
              </Field>
              <Field label="Provincia">
                <input className="flux-input"
                  value={cliente.provincia}
                  onChange={e => setCliente(c => ({ ...c, provincia: e.target.value }))} />
              </Field>
            </div>
          </div>

          <Field label="Observaciones internas">
            <textarea rows={2} className="flux-input resize-none text-sm"
              placeholder="Notas internas sobre el cliente (no aparecen en el PDF)"
              value={cliente.observaciones}
              onChange={e => setCliente(c => ({ ...c, observaciones: e.target.value }))} />
          </Field>
        </div>
      )

            // ── STEP 1: General ──────────────────────────────────
      case 1: return (
        <div className="space-y-5">
          <SH title="Información general de la propuesta" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Título de la propuesta" required>
                <input className="flux-input" placeholder="Ej: Automatización del proceso de ventas y CRM"
                  value={general.titulo}
                  onChange={e => setGeneral(g => ({ ...g, titulo: e.target.value }))} />
              </Field>
            </div>
            <Field label="Tipo de servicio" required>
              <select className="flux-input" value={general.tipoServicio}
                onChange={e => setGeneral(g => ({ ...g, tipoServicio: e.target.value }))}>
                <option value="">Seleccioná…</option>
                {TIPOS_SERVICIO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Responsable comercial">
              <input className="flux-input"
                value={general.responsable}
                onChange={e => setGeneral(g => ({ ...g, responsable: e.target.value }))} />
            </Field>
            <Field label="Fecha de emisión">
              <input type="date" className="flux-input"
                value={general.fechaEmision}
                onChange={e => setGeneral(g => ({ ...g, fechaEmision: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Validez (días)">
                <input type="number" min="1" className="flux-input"
                  value={general.validezDias}
                  onChange={e => setGeneral(g => ({ ...g, validezDias: parseInt(e.target.value) || 30 }))} />
              </Field>
              <Field label="Vencimiento">
                <input type="date" className="flux-input"
                  value={general.fechaVencimiento}
                  onChange={e => setGeneral(g => ({ ...g, fechaVencimiento: e.target.value }))} />
              </Field>
            </div>
            <Field label="Email de contacto Fluxtic">
              <input type="email" className="flux-input"
                value={general.emailContacto}
                onChange={e => setGeneral(g => ({ ...g, emailContacto: e.target.value }))} />
            </Field>
          </div>
          <Field label="Resumen ejecutivo">
            <textarea rows={4} className="flux-input resize-none text-sm"
              placeholder="Descripción breve y directa de la propuesta para el cliente…"
              value={general.resumenEjecutivo}
              onChange={e => setGeneral(g => ({ ...g, resumenEjecutivo: e.target.value }))} />
          </Field>
          <Field label="Objetivo de la propuesta">
            <textarea rows={3} className="flux-input resize-none text-sm"
              placeholder="¿Qué se busca resolver o implementar?"
              value={general.objetivo}
              onChange={e => setGeneral(g => ({ ...g, objetivo: e.target.value }))} />
          </Field>
          <Field label="Contexto / Diagnóstico del cliente">
            <textarea rows={3} className="flux-input resize-none text-sm"
              placeholder="Situación actual del cliente y motivación del proyecto…"
              value={general.contexto}
              onChange={e => setGeneral(g => ({ ...g, contexto: e.target.value }))} />
          </Field>
        </div>
      )

      // ── STEP 2: Alcance ──────────────────────────────────
      case 2: return (
        <div className="space-y-5">
          <SH title="Alcance de la oferta y entregables" />
          <Field label="Alcance general">
            <textarea rows={4} className="flux-input resize-none text-sm"
              placeholder="¿Qué incluye esta propuesta en términos generales?"
              value={alcance.alcanceGeneral}
              onChange={e => setAlcance(a => ({ ...a, alcanceGeneral: e.target.value }))} />
          </Field>
          <Field label="Alcance técnico">
            <textarea rows={4} className="flux-input resize-none text-sm"
              placeholder="Detalle técnico de lo que se va a implementar…"
              value={alcance.alcanceTecnico}
              onChange={e => setAlcance(a => ({ ...a, alcanceTecnico: e.target.value }))} />
          </Field>
          <Field label="Entregables">
            <textarea rows={3} className="flux-input resize-none text-sm"
              placeholder="Lista de entregables comprometidos (uno por línea)"
              value={alcance.entregables}
              onChange={e => setAlcance(a => ({ ...a, entregables: e.target.value }))} />
          </Field>
          <Field label="Fuera de alcance">
            <textarea rows={3} className="flux-input resize-none text-sm"
              placeholder="¿Qué NO está incluido? (evita malos entendidos)"
              value={alcance.fueraAlcance}
              onChange={e => setAlcance(a => ({ ...a, fueraAlcance: e.target.value }))} />
          </Field>
          <Field label="Requisitos del cliente">
            <textarea rows={2} className="flux-input resize-none text-sm"
              placeholder="¿Qué debe proveer o habilitar el cliente?"
              value={alcance.requisitos}
              onChange={e => setAlcance(a => ({ ...a, requisitos: e.target.value }))} />
          </Field>
          <Field label="Supuestos y condiciones">
            <textarea rows={2} className="flux-input resize-none text-sm"
              placeholder="Supuestos bajo los que fue elaborada esta propuesta…"
              value={alcance.supuestos}
              onChange={e => setAlcance(a => ({ ...a, supuestos: e.target.value }))} />
          </Field>

          {/* Etapas */}
          <div>
            <SH title="Plan de trabajo" subtitle="Editá las etapas y duraciones estimadas" />
            <div className="space-y-3">
              {alcance.etapas.map((etapa, i) => (
                <div key={etapa.id} className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-flux-surface border border-flux-border rounded-xl">
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-bold text-flux-teal mt-1 w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                    <input className="flux-input text-sm flex-1" placeholder="Nombre de la etapa"
                      value={etapa.nombre}
                      onChange={e => updateEtapa(etapa.id, 'nombre', e.target.value)} />
                  </div>
                  <input className="flux-input text-sm" placeholder="Descripción breve"
                    value={etapa.descripcion}
                    onChange={e => updateEtapa(etapa.id, 'descripcion', e.target.value)} />
                  <input className="flux-input text-sm" placeholder="Duración estimada"
                    value={etapa.duracion}
                    onChange={e => updateEtapa(etapa.id, 'duracion', e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )

      // ── STEP 3: Costos ───────────────────────────────────
      case 3: return (
        <div className="space-y-5">
          <SH title="Detalle de costos" subtitle="Tabla editable de ítems — el subtotal se calcula automáticamente" />

          {/* Configuración */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex gap-2 items-center">
              <label className="text-xs font-medium text-flux-text2">Moneda:</label>
              {(['ARS', 'USD'] as const).map(m => (
                <button key={m} onClick={() => setCostos(c => ({ ...c, moneda: m }))}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                    costos.moneda === m ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3')}>
                  {m}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-flux-text2">
              <input type="checkbox" checked={costos.incluyeIVA}
                onChange={e => setCostos(c => ({ ...c, incluyeIVA: e.target.checked }))} />
              Precios incluyen IVA
            </label>
            {!costos.incluyeIVA && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-flux-text2">IVA %:</label>
                <input type="number" min="0" max="100" className="flux-input w-20 text-center"
                  value={costos.tasaIVA}
                  onChange={e => setCostos(c => ({ ...c, tasaIVA: parseFloat(e.target.value) || 0 }))} />
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-flux-border">
                  {['Descripción', 'Cat.', 'Cant.', 'Unidad', 'Precio unit.', 'Desc.%', 'Tipo', 'Subtotal', ''].map(h => (
                    <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest py-2 pr-2 first:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {costos.items.map(item => (
                  <tr key={item.id} className="border-b border-flux-border/40">
                    <td className="py-2 pr-2" style={{ minWidth: 180 }}>
                      <input className="flux-input text-sm py-1.5" placeholder="Descripción del ítem…"
                        value={item.descripcion}
                        onChange={e => updateItem(item.id, 'descripcion', e.target.value)} />
                    </td>
                    <td className="py-2 pr-2" style={{ minWidth: 120 }}>
                      <select className="flux-input text-xs py-1.5" value={item.categoria}
                        onChange={e => updateItem(item.id, 'categoria', e.target.value)}>
                        {ITEM_CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2" style={{ minWidth: 70 }}>
                      <input type="number" min="1" step="0.5" className="flux-input text-sm py-1.5 text-center"
                        value={item.cantidad}
                        onChange={e => updateItem(item.id, 'cantidad', parseFloat(e.target.value) || 1)} />
                    </td>
                    <td className="py-2 pr-2" style={{ minWidth: 80 }}>
                      <input className="flux-input text-sm py-1.5"
                        value={item.unidad}
                        onChange={e => updateItem(item.id, 'unidad', e.target.value)} />
                    </td>
                    <td className="py-2 pr-2" style={{ minWidth: 110 }}>
                      <input type="number" min="0" step="100" className="flux-input text-sm py-1.5 text-right"
                        value={item.precioUnit || ''}
                        placeholder="0"
                        onChange={e => updateItem(item.id, 'precioUnit', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="py-2 pr-2" style={{ minWidth: 60 }}>
                      <input type="number" min="0" max="100" className="flux-input text-sm py-1.5 text-center"
                        value={item.descuento || ''}
                        placeholder="0"
                        onChange={e => updateItem(item.id, 'descuento', parseFloat(e.target.value) || 0)} />
                    </td>
                    <td className="py-2 pr-2" style={{ minWidth: 100 }}>
                      <select className="flux-input text-xs py-1.5" value={item.tipo}
                        onChange={e => updateItem(item.id, 'tipo', e.target.value as any)}>
                        {Object.entries(ITEM_TIPO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-right font-medium text-flux-teal whitespace-nowrap" style={{ minWidth: 100 }}>
                      {item.subtotal > 0 ? formatMoney(item.subtotal, costos.moneda) : '—'}
                    </td>
                    <td className="py-2">
                      <button onClick={() => removeItem(item.id)}
                        className="p-1 text-flux-text3 hover:text-flux-danger transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addItem}
            className="w-full border border-dashed border-flux-border rounded-xl py-3 text-xs text-flux-text3 hover:border-flux-teal hover:text-flux-teal transition-all flex items-center justify-center gap-2">
            <Plus size={13} /> Agregar ítem
          </button>

          {/* Totales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 text-sm p-4 bg-flux-surface border border-flux-border rounded-xl">
              <p className="text-2xs font-bold text-flux-text3 uppercase tracking-widest mb-2">Resumen de costos</p>
              <div className="flex justify-between">
                <span className="text-flux-text3">Únicos</span>
                <span className="font-medium">{formatMoney(tots.totalUnico, costos.moneda)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-flux-text3">Mensual</span>
                <span className="font-medium">{formatMoney(tots.totalMensual, costos.moneda)}/mes</span>
              </div>
              <div className="flex justify-between">
                <span className="text-flux-text3">Anual</span>
                <span className="font-medium">{formatMoney(tots.totalAnual, costos.moneda)}/año</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-sm p-4 bg-flux-surface border border-flux-border rounded-xl">
              <p className="text-2xs font-bold text-flux-text3 uppercase tracking-widest mb-2">Total</p>
              {tots.descuentoTotal > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Descuentos</span>
                  <span>- {formatMoney(tots.descuentoTotal, costos.moneda)}</span>
                </div>
              )}
              {!costos.incluyeIVA && (
                <div className="flex justify-between">
                  <span className="text-flux-text3">IVA ({costos.tasaIVA}%)</span>
                  <span>{formatMoney(tots.ivaTotal, costos.moneda)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t border-flux-border mt-1">
                <span className="font-bold text-flux-teal">TOTAL</span>
                <span className="font-black text-flux-teal text-lg">{formatMoney(tots.total, costos.moneda)}</span>
              </div>
            </div>
          </div>
        </div>
      )

      // ── STEP 4: Condiciones ──────────────────────────────
      case 4: return (
        <div className="space-y-5">
          <SH title="Condiciones comerciales" />
          <Field label="Forma de pago">
            <input className="flux-input"
              value={condiciones.formaPago}
              onChange={e => setCondiciones(c => ({ ...c, formaPago: e.target.value }))} />
          </Field>
          <Field label="Condiciones comerciales">
            <textarea rows={8} className="flux-input resize-none text-sm"
              value={condiciones.condicionesComerciales}
              onChange={e => setCondiciones(c => ({ ...c, condicionesComerciales: e.target.value }))} />
          </Field>
          <Field label="Notas internas">
            <textarea rows={3} className="flux-input resize-none text-sm"
              placeholder="Notas para el equipo (no aparecen en el PDF)"
              value={condiciones.notasInternas}
              onChange={e => setCondiciones(c => ({ ...c, notasInternas: e.target.value }))} />
          </Field>
        </div>
      )

      // ── STEP 5: Preview ──────────────────────────────────
      case 5: return (
        <div className="space-y-4">
          <SH title="Vista previa de la propuesta" subtitle="Revisá el documento antes de guardar o enviar" />

          <div className="bg-white text-gray-900 rounded-2xl p-8 shadow-lg text-sm" style={{ fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-200">
              <div>
                <p className="text-2xl font-black text-[#082a44]">FLUXTIC</p>
                <p className="text-xs text-[#159fe3] font-medium">Automatizaciones Inteligentes</p>
                <p className="text-xs text-gray-500 mt-1">{DATOS_FLUXTIC.email} · {DATOS_FLUXTIC.sitio}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold text-[#082a44] text-lg">{numero}</p>
                <p className="text-xs text-gray-500">Emisión: {general.fechaEmision}</p>
                <p className="text-xs text-gray-500">Vence: {general.fechaVencimiento}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-[#eef8ff] text-[#159fe3] text-xs font-bold rounded">
                  BORRADOR
                </span>
              </div>
            </div>

            {/* Client */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Destinatario</p>
              <p className="font-bold text-[#082a44]">{cliente.razonSocial || '—'}</p>
              {cliente.contacto && <p className="text-sm text-gray-600">Attn: {cliente.contacto}</p>}
              {cliente.email    && <p className="text-sm text-gray-500">{cliente.email}</p>}
            </div>

            {/* Title */}
            <h1 className="text-xl font-black text-[#082a44] mb-2">{general.titulo || '(Sin título)'}</h1>
            <p className="text-xs text-[#159fe3] font-medium mb-6">{general.tipoServicio}</p>

            {/* Sections */}
            {general.resumenEjecutivo && (
              <div className="mb-4">
                <p className="text-xs font-bold text-[#082a44] uppercase tracking-widest border-b border-gray-200 pb-1 mb-2">Resumen ejecutivo</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{general.resumenEjecutivo}</p>
              </div>
            )}

            {costos.items.filter(i => i.descripcion).length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-[#082a44] uppercase tracking-widest border-b border-gray-200 pb-1 mb-2">Inversión</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#082a44] text-white">
                      <th className="text-left p-2">Descripción</th>
                      <th className="text-center p-2">Cant.</th>
                      <th className="text-right p-2">Precio unit.</th>
                      <th className="text-right p-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costos.items.filter(i => i.descripcion).map((item, i) => (
                      <tr key={item.id} style={{ background: i % 2 === 0 ? '#f9fafb' : 'white' }}>
                        <td className="p-2">{item.descripcion}</td>
                        <td className="p-2 text-center">{item.cantidad} {item.unidad}</td>
                        <td className="p-2 text-right">{formatMoney(item.precioUnit, costos.moneda)}</td>
                        <td className="p-2 text-right font-medium">{formatMoney(item.subtotal, costos.moneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end mt-3">
                  <div className="w-48 space-y-1 text-xs">
                    {!costos.incluyeIVA && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">IVA ({costos.tasaIVA}%)</span>
                        <span>{formatMoney(tots.ivaTotal, costos.moneda)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[#082a44] border-t pt-1">
                      <span>TOTAL</span>
                      <span>{formatMoney(tots.total, costos.moneda)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 pt-4 border-t border-gray-200 text-center">
              <p className="text-xs text-gray-400">La información incluida en esta propuesta es confidencial y fue elaborada exclusivamente para el cliente destinatario.</p>
              <p className="text-xs text-gray-400 mt-1">© {DATOS_FLUXTIC.empresa} · {DATOS_FLUXTIC.email}</p>
            </div>
          </div>
        </div>
      )

      default: return null
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Nuevo presupuesto · ${numero}`}
        subtitle={STEPS[step].label}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/presupuestos" className="btn-ghost flex items-center gap-2 text-sm">
              <ArrowLeft size={14} /> Volver
            </Link>
            <button onClick={() => handleSave('borrador')} disabled={saving}
              className="btn-ghost flex items-center gap-2 text-sm">
              {saving ? <Spinner size={14} /> : <Save size={14} />} Guardar borrador
            </button>
          </div>
        }
      />

      <div className="px-4 md:px-8 pb-10 pt-4">

        {/* Step indicator */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => { setErrorMsg(''); setStep(i) }}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all',
                i === step
                  ? 'bg-flux-teal text-flux-bg'
                  : i < step
                  ? 'bg-flux-tealGlow text-flux-teal'
                  : 'bg-flux-muted text-flux-text3'
              )}>
              {i < step && <CheckCircle size={12} />}
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm text-red-300 mb-4"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <AlertCircle size={15} className="shrink-0 mt-0.5" /> {errorMsg}
          </div>
        )}

        <div className="flux-card">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-5">
          <button onClick={prevStep} disabled={step === 0}
            className="btn-ghost flex items-center gap-2 disabled:opacity-40">
            <ArrowLeft size={14} /> Anterior
          </button>

          <div className="flex gap-2">
            {step === STEPS.length - 1 ? (
              <>
                <button onClick={() => handleSave('borrador')} disabled={saving}
                  className="btn-ghost flex items-center gap-2">
                  {saving ? <Spinner size={14} /> : <Save size={14} />} Guardar borrador
                </button>
                <button onClick={() => handleSave('enviado')} disabled={saving}
                  className="btn-primary flex items-center gap-2">
                  {saving ? <Spinner size={14} /> : <Send size={14} />} Guardar y enviar
                </button>
              </>
            ) : (
              <button onClick={nextStep} className="btn-primary flex items-center gap-2">
                Siguiente <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
