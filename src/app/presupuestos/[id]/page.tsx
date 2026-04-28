'use client'

import { useState, useEffect }  from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthContext }       from '@/components/auth/AuthProvider'
import { PageHeader }           from '@/components/layout/PageHeader'
import { Spinner }              from '@/components/ui'
import { db }                   from '@/lib/firebase/config'
import {
  doc, getDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import type { Presupuesto }     from '@/types/presupuestos'
import { ESTADO_CONFIG, formatMoney } from '@/types/presupuestos'
import { cn }                   from '@/lib/utils'
import { format }               from 'date-fns'
import { es }                   from 'date-fns/locale'
import {
  ArrowLeft, Send, CheckCircle, XCircle,
  Mail, Download, Pencil, Copy,
} from 'lucide-react'
import Link from 'next/link'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date(ts)
}

// ── Email modal ───────────────────────────────────────────
function EmailModal({ pres, onClose }: { pres: Presupuesto; onClose: () => void }) {
  const [to,      setTo]      = useState(pres.clienteData?.email ?? '')
  const [cc,      setCc]      = useState('')
  const [subject, setSubject] = useState(`Propuesta comercial Fluxtic - ${pres.clienteData?.razonSocial ?? ''}`)
  const [body,    setBody]    = useState(
`Hola ${pres.clienteData?.contacto ?? pres.clienteData?.razonSocial ?? ''},

Te compartimos la propuesta comercial de Fluxtic correspondiente a "${pres.titulo}".

Quedamos atentos a cualquier consulta o ajuste que consideren necesario revisar.

Saludos,
Equipo Fluxtic
contacto@fluxtic.com`
  )
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const { user }              = useAuthContext()

  async function handleSend() {
    setSending(true)
    try {
      const tokenSnap = await getDoc(doc(db, 'googleTokens', user?.uid ?? ''))
      if (tokenSnap.exists()) {
        const tokens = tokenSnap.data()
        const res = await fetch('/api/gmail/send', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token:  tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date:   tokens.expiry_date,
            to, subject, body,
          }),
        })
        const data = await res.json()
        if (data.success) {
          await updateDoc(doc(db, 'budgets', pres.id), {
            estado: 'enviado', enviadoEn: serverTimestamp(), actualizadoEn: serverTimestamp(),
          })
          setSent(true)
          setTimeout(onClose, 1500)
          return
        }
      }
      // Fallback: mailto
      const mailto = `mailto:${to}?cc=${cc}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      window.open(mailto)
      onClose()
    } finally { setSending(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-flux-card border border-flux-border rounded-2xl p-6 space-y-4 shadow-card-hover">
        <h2 className="font-bold text-flux-white">Enviar propuesta por email</h2>
        {sent ? (
          <div className="flex items-center gap-2 text-green-400 py-4 justify-center">
            <CheckCircle size={20} /> Email enviado correctamente
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Destinatario</label>
                <input type="email" className="flux-input" value={to} onChange={e => setTo(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">CC</label>
                <input type="email" className="flux-input" placeholder="Opcional" value={cc} onChange={e => setCc(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Asunto</label>
                <input className="flux-input" value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Mensaje</label>
                <textarea rows={6} className="flux-input resize-none text-sm" value={body} onChange={e => setBody(e.target.value)} />
              </div>
            </div>
            <p className="text-2xs text-flux-text3">
              ℹ️ El PDF debe descargarse por separado y adjuntarse manualmente al email.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="btn-ghost">Cancelar</button>
              <button onClick={handleSend} disabled={sending || !to}
                className="btn-primary flex items-center gap-2">
                {sending ? <Spinner size={14} /> : <Send size={14} />}
                Enviar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function PresupuestoDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { user } = useAuthContext()

  const [pres,      setPres]      = useState<Presupuesto | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [showEmail, setShowEmail] = useState(false)
  const [msg,       setMsg]       = useState('')

  useEffect(() => {
    getDoc(doc(db, 'budgets', id)).then(snap => {
      if (snap.exists()) setPres({ id: snap.id, ...snap.data() } as Presupuesto)
      setLoading(false)
    })
  }, [id])

  async function changeEstado(estado: Presupuesto['estado']) {
    if (!pres) return
    const extra: Record<string, any> = { estado, actualizadoEn: serverTimestamp() }
    if (estado === 'aprobado')  extra.aprobadoEn  = serverTimestamp()
    if (estado === 'rechazado') extra.rechazadoEn = serverTimestamp()
    if (estado === 'enviado')   extra.enviadoEn   = serverTimestamp()
    await updateDoc(doc(db, 'budgets', id), extra)
    setPres(p => p ? { ...p, estado } : p)
    setMsg(`Estado actualizado a: ${estado}`)
    setTimeout(() => setMsg(''), 3000)
  }

  function handleDownloadPDF() {
    if (!pres) return
    // Open print dialog — user can save as PDF
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const items = pres.items?.filter(i => i.descripcion) ?? []
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Presupuesto ${pres.budgetNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; font-size: 12px; line-height: 1.5; }
  .page { padding: 48px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #082a44; }
  .brand h1 { font-size: 28px; font-weight: 900; color: #082a44; letter-spacing: -0.02em; }
  .brand h1 span { color: #159fe3; }
  .brand p { font-size: 11px; color: #159fe3; margin-top: 2px; }
  .brand .contact { font-size: 10px; color: #6b7280; margin-top: 6px; }
  .meta { text-align: right; }
  .meta .num { font-family: monospace; font-size: 18px; font-weight: 900; color: #082a44; }
  .meta p { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 99px; font-size: 10px; font-weight: 700; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge-borrador  { background: #f3f4f6; color: #6b7280; }
  .badge-enviado   { background: #dbeafe; color: #1d4ed8; }
  .badge-aprobado  { background: #d1fae5; color: #065f46; }
  .badge-rechazado { background: #fee2e2; color: #991b1b; }
  .cliente { background: #f9fafb; border-left: 4px solid #159fe3; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 32px; }
  .cliente h2 { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
  .cliente .name { font-size: 18px; font-weight: 800; color: #082a44; }
  .cliente .info { font-size: 11px; color: #6b7280; margin-top: 3px; }
  .title { font-size: 22px; font-weight: 800; color: #082a44; margin-bottom: 4px; }
  .subtitle { font-size: 12px; color: #159fe3; font-weight: 600; margin-bottom: 32px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; font-weight: 800; color: #082a44; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
  .section p { color: #374151; white-space: pre-line; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #082a44; color: white; padding: 8px 12px; font-size: 10px; text-align: left; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 8px 12px; font-size: 11px; border-bottom: 1px solid #f3f4f6; }
  tr:nth-child(even) td { background: #f9fafb; }
  .totals { margin-left: auto; width: 220px; }
  .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .totals .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; font-weight: 800; color: #082a44; border-top: 2px solid #082a44; margin-top: 4px; }
  .etapa { display: flex; gap: 12px; margin-bottom: 10px; }
  .etapa-num { width: 28px; height: 28px; background: #082a44; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .etapa-info h4 { font-size: 12px; font-weight: 700; color: #082a44; }
  .etapa-info p { font-size: 11px; color: #6b7280; }
  .firma { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
  .firma-box { border-top: 1px solid #d1d5db; padding-top: 8px; }
  .firma-box p { font-size: 10px; color: #9ca3af; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .footer p { font-size: 10px; color: #9ca3af; }
  .confidencial { font-style: italic; color: #9ca3af; font-size: 10px; text-align: center; margin-top: 12px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 32px; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="header">
    <div class="brand">
      <h1>FLUX<span>TIC</span></h1>
      <p>Automatizaciones Inteligentes</p>
      <div class="contact">contacto@fluxtic.com &nbsp;·&nbsp; fluxtic.com</div>
    </div>
    <div class="meta">
      <div class="num">${pres.budgetNumber}</div>
      <p>Emisión: ${pres.fechaEmision ?? '—'}</p>
      <p>Vence: ${pres.fechaVencimiento ?? '—'}</p>
      <span class="badge badge-${pres.estado}">${pres.estado.toUpperCase()}</span>
    </div>
  </div>

  <div class="cliente">
    <h2>Destinatario</h2>
    <div class="name">${pres.clienteData?.razonSocial ?? '—'}</div>
    ${pres.clienteData?.contacto ? `<div class="info">Attn: ${pres.clienteData.contacto}</div>` : ''}
    ${pres.clienteData?.email    ? `<div class="info">${pres.clienteData.email}</div>` : ''}
    ${pres.clienteData?.cuitDni  ? `<div class="info">CUIT/DNI: ${pres.clienteData.cuitDni}</div>` : ''}
  </div>

  <div class="title">${pres.titulo ?? '—'}</div>
  <div class="subtitle">${pres.tipoServicio ?? ''}</div>

  <div class="section">
    <div class="section-title">Presentación</div>
    <p>Fluxtic es una empresa orientada a la implementación de soluciones tecnológicas, automatización de procesos, integraciones digitales e inteligencia artificial aplicada a la gestión comercial y operativa. Nuestro enfoque combina análisis, diseño funcional e implementación técnica para ayudar a las organizaciones a ordenar, automatizar y escalar sus procesos.</p>
  </div>

  ${pres.resumenEjecutivo ? `<div class="section"><div class="section-title">Resumen ejecutivo</div><p>${pres.resumenEjecutivo}</p></div>` : ''}
  ${pres.objetivo        ? `<div class="section"><div class="section-title">Objetivo</div><p>${pres.objetivo}</p></div>` : ''}
  ${pres.contexto        ? `<div class="section"><div class="section-title">Contexto</div><p>${pres.contexto}</p></div>` : ''}
  ${pres.alcanceGeneral  ? `<div class="section"><div class="section-title">Alcance general</div><p>${pres.alcanceGeneral}</p></div>` : ''}
  ${pres.alcanceTecnico  ? `<div class="section"><div class="section-title">Alcance técnico</div><p>${pres.alcanceTecnico}</p></div>` : ''}
  ${pres.entregables     ? `<div class="section"><div class="section-title">Entregables</div><p>${pres.entregables}</p></div>` : ''}
  ${pres.fueraAlcance    ? `<div class="section"><div class="section-title">Fuera de alcance</div><p>${pres.fueraAlcance}</p></div>` : ''}

  ${pres.etapas?.length ? `
  <div class="section">
    <div class="section-title">Plan de trabajo</div>
    ${pres.etapas.map((e, i) => `
    <div class="etapa">
      <div class="etapa-num">${String(i+1).padStart(2,'0')}</div>
      <div class="etapa-info">
        <h4>${e.nombre}</h4>
        <p>${e.descripcion}${e.duracion ? ` &mdash; ${e.duracion}` : ''}</p>
      </div>
    </div>`).join('')}
  </div>` : ''}

  ${items.length ? `
  <div class="section">
    <div class="section-title">Inversión</div>
    <table>
      <thead><tr>
        <th>Descripción</th><th>Cat.</th><th>Cant.</th><th>Precio unit.</th><th>Desc.</th><th>Subtotal</th><th>Tipo</th>
      </tr></thead>
      <tbody>
        ${items.map(i => `<tr>
          <td>${i.descripcion}</td>
          <td>${i.categoria ?? ''}</td>
          <td>${i.cantidad} ${i.unidad ?? ''}</td>
          <td>${formatMoney(i.precioUnit ?? 0, pres.moneda)}</td>
          <td>${i.descuento ?? 0}%</td>
          <td><strong>${formatMoney(i.subtotal ?? 0, pres.moneda)}</strong></td>
          <td>${i.tipo ?? ''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals">
      ${pres.descuentoTotal ? `<div class="row"><span>Descuentos</span><span>- ${formatMoney(pres.descuentoTotal, pres.moneda)}</span></div>` : ''}
      ${!pres.incluyeIVA && pres.ivaTotal ? `<div class="row"><span>IVA (${pres.tasaIVA}%)</span><span>${formatMoney(pres.ivaTotal, pres.moneda)}</span></div>` : ''}
      <div class="total-row"><span>TOTAL</span><span>${formatMoney(pres.total ?? 0, pres.moneda)}</span></div>
      ${pres.totalUnico    ? `<div class="row" style="font-size:10px;color:#6b7280"><span>Único</span><span>${formatMoney(pres.totalUnico, pres.moneda)}</span></div>` : ''}
      ${pres.totalMensual  ? `<div class="row" style="font-size:10px;color:#6b7280"><span>Mensual</span><span>${formatMoney(pres.totalMensual, pres.moneda)}/mes</span></div>` : ''}
      ${pres.totalAnual    ? `<div class="row" style="font-size:10px;color:#6b7280"><span>Anual</span><span>${formatMoney(pres.totalAnual, pres.moneda)}/año</span></div>` : ''}
    </div>
  </div>` : ''}

  ${pres.condicionesComerciales ? `
  <div class="section">
    <div class="section-title">Condiciones comerciales</div>
    <p>${pres.condicionesComerciales}</p>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Aceptación</div>
    <div class="firma">
      <div class="firma-box"><p>Firma del cliente</p></div>
      <div class="firma-box"><p>Aclaración / DNI / CUIT / Fecha</p></div>
    </div>
  </div>

  <div class="footer">
    <p>Fluxtic &nbsp;·&nbsp; contacto@fluxtic.com &nbsp;·&nbsp; fluxtic.com</p>
    <p>${pres.budgetNumber}</p>
  </div>
  <p class="confidencial">La información incluida en esta propuesta es confidencial y fue elaborada exclusivamente para el cliente destinatario.</p>

</div>
<script>window.onload = () => { window.print(); }</script>
</body>
</html>`)
    printWindow.document.close()
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size={24} /></div>
  if (!pres)   return <div className="px-8 py-10 text-flux-text3">Presupuesto no encontrado.</div>

  const est = ESTADO_CONFIG[pres.estado]

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title={pres.budgetNumber}
          subtitle={`${pres.clienteData?.razonSocial ?? ''} · ${pres.titulo ?? ''}`}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/presupuestos" className="btn-ghost flex items-center gap-2 text-sm">
                <ArrowLeft size={14} /> Volver
              </Link>
              <Link href={`/presupuestos/${id}/editar`}
                className="btn-ghost flex items-center gap-2 text-sm">
                <Pencil size={14} /> Editar
              </Link>
              <button onClick={handleDownloadPDF}
                className="btn-ghost flex items-center gap-2 text-sm">
                <Download size={14} /> Descargar PDF
              </button>
              <button onClick={() => setShowEmail(true)}
                className="btn-primary flex items-center gap-2 text-sm">
                <Send size={14} /> Enviar por email
              </button>
            </div>
          }
        />

        <div className="px-4 md:px-8 pb-10 space-y-5 pt-4 max-w-4xl">

          {msg && (
            <div className="px-4 py-3 rounded-xl text-sm text-green-300 bg-green-950/30 border border-green-800/30">
              ✅ {msg}
            </div>
          )}

          {/* Estado + cambios */}
          <div className="flux-card flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-lg text-sm font-bold"
                style={{ color: est.color, background: est.bg }}>
                {est.label}
              </span>
              <span className="text-xs text-flux-text3">
                Creado: {format(toDate(pres.creadoEn), "d 'de' MMMM yyyy", { locale: es })}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['borrador','enviado','aprobado','rechazado','vencido'] as const)
                .filter(e => e !== pres.estado)
                .map(e => (
                  <button key={e} onClick={() => changeEstado(e)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-flux-text3 hover:text-flux-text1 hover:bg-flux-muted transition-all capitalize">
                    → {ESTADO_CONFIG[e].label}
                  </button>
                ))}
            </div>
          </div>

          {/* Datos cliente */}
          <div className="flux-card grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-3">Cliente</p>
              <p className="font-bold text-flux-white text-lg">{pres.clienteData?.razonSocial ?? '—'}</p>
              {pres.clienteData?.contacto && <p className="text-sm text-flux-text2 mt-1">{pres.clienteData.contacto}</p>}
              {pres.clienteData?.email    && <p className="text-sm text-flux-teal">{pres.clienteData.email}</p>}
              {pres.clienteData?.telefono && <p className="text-xs text-flux-text3">{pres.clienteData.telefono}</p>}
              {pres.clienteData?.cuitDni  && <p className="text-xs text-flux-text3">CUIT/DNI: {pres.clienteData.cuitDni}</p>}
            </div>
            <div>
              <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-3">Presupuesto</p>
              <p className="font-bold text-flux-white font-mono text-lg">{pres.budgetNumber}</p>
              <p className="text-sm text-flux-text2 mt-1">{pres.titulo}</p>
              {pres.tipoServicio && <p className="text-xs text-flux-teal mt-1">{pres.tipoServicio}</p>}
              <p className="text-xs text-flux-text3 mt-1">Responsable: {pres.responsable || '—'}</p>
              <p className="text-xs text-flux-text3">Válido: {pres.validezDias} días</p>
              {pres.fechaVencimiento && (
                <p className="text-xs text-flux-text3">Vence: {pres.fechaVencimiento}</p>
              )}
            </div>
          </div>

          {/* Contenido */}
          {[
            { label: 'Resumen ejecutivo', val: pres.resumenEjecutivo },
            { label: 'Objetivo',          val: pres.objetivo         },
            { label: 'Contexto',          val: pres.contexto         },
            { label: 'Alcance general',   val: pres.alcanceGeneral   },
            { label: 'Alcance técnico',   val: pres.alcanceTecnico   },
            { label: 'Entregables',       val: pres.entregables      },
            { label: 'Fuera de alcance',  val: pres.fueraAlcance     },
            { label: 'Requisitos',        val: pres.requisitos       },
            { label: 'Supuestos',         val: pres.supuestos        },
          ].filter(s => s.val).map(s => (
            <div key={s.label} className="flux-card">
              <p className="text-xs font-bold text-flux-text3 uppercase tracking-widest mb-3">{s.label}</p>
              <p className="text-sm text-flux-text2 whitespace-pre-line leading-relaxed">{s.val}</p>
            </div>
          ))}

          {/* Etapas */}
          {pres.etapas?.length > 0 && (
            <div className="flux-card">
              <p className="text-xs font-bold text-flux-text3 uppercase tracking-widest mb-4">Plan de trabajo</p>
              <div className="space-y-3">
                {pres.etapas.map((e, i) => (
                  <div key={e.id} className="flex gap-4 items-start">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: '#082a44' }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-flux-text1">{e.nombre}</p>
                      <p className="text-xs text-flux-text3">{e.descripcion}</p>
                      {e.duracion && <p className="text-xs text-flux-teal mt-0.5">⏱ {e.duracion}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          {pres.items?.filter(i => i.descripcion).length > 0 && (
            <div className="flux-card">
              <p className="text-xs font-bold text-flux-text3 uppercase tracking-widest mb-4">Inversión</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-flux-border">
                      {['Descripción', 'Cat.', 'Cant.', 'Precio unit.', 'Desc.%', 'Tipo', 'Subtotal'].map(h => (
                        <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest py-2 pr-4 last:text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pres.items.filter(i => i.descripcion).map((item, i) => (
                      <tr key={i} className="border-b border-flux-border/30">
                        <td className="py-3 pr-4 text-flux-text1">{item.descripcion}</td>
                        <td className="py-3 pr-4 text-xs text-flux-text3">{item.categoria}</td>
                        <td className="py-3 pr-4 text-center">{item.cantidad} {item.unidad}</td>
                        <td className="py-3 pr-4 text-right">{formatMoney(item.precioUnit ?? 0, pres.moneda)}</td>
                        <td className="py-3 pr-4 text-center">{item.descuento ?? 0}%</td>
                        <td className="py-3 pr-4 text-xs text-flux-text3 capitalize">{item.tipo}</td>
                        <td className="py-3 text-right font-bold text-flux-teal">{formatMoney(item.subtotal ?? 0, pres.moneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-4">
                <div className="w-64 space-y-1.5 text-sm">
                  {(pres.descuentoTotal ?? 0) > 0 && (
                    <div className="flex justify-between text-green-400">
                      <span>Descuentos</span>
                      <span>- {formatMoney(pres.descuentoTotal!, pres.moneda)}</span>
                    </div>
                  )}
                  {!pres.incluyeIVA && (pres.ivaTotal ?? 0) > 0 && (
                    <div className="flex justify-between text-flux-text3">
                      <span>IVA ({pres.tasaIVA ?? 21}%)</span>
                      <span>{formatMoney(pres.ivaTotal!, pres.moneda)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 px-4 rounded-xl font-bold border-t border-flux-border mt-2"
                    style={{ background: 'rgba(0,212,168,0.1)' }}>
                    <span className="text-flux-teal text-base">TOTAL</span>
                    <span className="text-flux-teal text-xl">{formatMoney(pres.total ?? 0, pres.moneda)}</span>
                  </div>
                  {(pres.totalUnico ?? 0) > 0 && (
                    <div className="flex justify-between text-xs text-flux-text3">
                      <span>Único</span><span>{formatMoney(pres.totalUnico!, pres.moneda)}</span>
                    </div>
                  )}
                  {(pres.totalMensual ?? 0) > 0 && (
                    <div className="flex justify-between text-xs text-flux-text3">
                      <span>Mensual</span><span>{formatMoney(pres.totalMensual!, pres.moneda)}/mes</span>
                    </div>
                  )}
                  {(pres.totalAnual ?? 0) > 0 && (
                    <div className="flex justify-between text-xs text-flux-text3">
                      <span>Anual</span><span>{formatMoney(pres.totalAnual!, pres.moneda)}/año</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Condiciones */}
          {pres.condicionesComerciales && (
            <div className="flux-card">
              <p className="text-xs font-bold text-flux-text3 uppercase tracking-widest mb-3">Condiciones comerciales</p>
              <pre className="text-sm text-flux-text2 whitespace-pre-wrap font-sans leading-relaxed">{pres.condicionesComerciales}</pre>
            </div>
          )}
        </div>
      </div>

      {showEmail && pres && <EmailModal pres={pres} onClose={() => setShowEmail(false)} />}
    </>
  )
}
