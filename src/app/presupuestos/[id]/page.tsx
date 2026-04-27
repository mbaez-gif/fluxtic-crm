'use client'

import { useState, useEffect }  from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthContext }       from '@/components/auth/AuthProvider'
import { PageHeader }           from '@/components/layout/PageHeader'
import { Spinner }              from '@/components/ui'
import { db }                  from '@/lib/firebase/config'
import {
  doc, getDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore'
import type { Presupuesto }    from '@/types/presupuestos'
import { ESTADO_PRESUPUESTO }  from '@/types/presupuestos'
import { cn }                  from '@/lib/utils'
import { format }              from 'date-fns'
import { es }                  from 'date-fns/locale'
import {
  ArrowLeft, Send, CheckCircle, XCircle,
  Mail, Clock, Printer, MoreHorizontal,
} from 'lucide-react'
import Link from 'next/link'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date(ts)
}

export default function PresupuestoDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const { user }  = useAuthContext()

  const [pres,    setPres]    = useState<Presupuesto | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [msg,     setMsg]     = useState('')

  useEffect(() => {
    getDoc(doc(db, 'presupuestos', id)).then(snap => {
      if (snap.exists()) setPres({ id: snap.id, ...snap.data() } as Presupuesto)
      setLoading(false)
    })
  }, [id])

  async function changeEstado(estado: Presupuesto['estado']) {
    if (!pres) return
    await updateDoc(doc(db, 'presupuestos', id), {
      estado,
      actualizadoEn: serverTimestamp(),
      ...(estado === 'aceptado' && { aceptadoEn: serverTimestamp() }),
    })
    setPres(p => p ? { ...p, estado } : p)
  }

  async function handleSendEmail() {
    if (!pres || !user) return
    setSending(true)
    setMsg('')
    try {
      const tokenSnap = await getDoc(doc(db, 'googleTokens', user.uid))
      if (!tokenSnap.exists()) {
        setMsg('Conectá tu cuenta de Google en Integraciones para enviar emails.')
        setSending(false)
        return
      }
      const tokens = tokenSnap.data()

      const body = `Hola ${pres.clienteNombre.split(' ')[0]},

Te enviamos el presupuesto ${pres.numero} de Fluxtic.

📋 Detalle:
${pres.items.map(i => `  • ${i.descripcion}: ${i.horas}h × $${i.valorHora.toLocaleString('es-AR')}/h = $${i.subtotal.toLocaleString('es-AR')}`).join('\n')}

⏱️ Horas totales: ${pres.totalHoras}h
💰 Total: $${pres.total.toLocaleString('es-AR')} (IVA incluido)
📅 Válido por: ${pres.validezDias} días

${pres.condiciones}

---
Cualquier consulta respondé este email o escribinos a info@fluxtic.com

Saludos,
${pres.creadoPorNombre}
Fluxtic — Automatizaciones Inteligentes`

      const res = await fetch('/api/gmail/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date:   tokens.expiry_date,
          to:      pres.clienteEmail,
          subject: `Presupuesto ${pres.numero} — Fluxtic`,
          body,
        }),
      })
      const data = await res.json()

      if (data.success) {
        await updateDoc(doc(db, 'presupuestos', id), {
          estado:        'enviado',
          enviadoEn:     serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        })
        setPres(p => p ? { ...p, estado: 'enviado' } : p)
        setMsg('✅ Email enviado correctamente a ' + pres.clienteEmail)
      } else {
        setMsg('❌ Error al enviar: ' + (data.error ?? 'Error desconocido'))
      }
    } catch (err: any) {
      setMsg('❌ ' + (err?.message ?? 'Error de conexión'))
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner size={24} /></div>
  if (!pres)   return <div className="px-8 py-10 text-flux-text3">Presupuesto no encontrado.</div>

  const est = ESTADO_PRESUPUESTO[pres.estado]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={pres.numero}
        subtitle={`${pres.clienteNombre} · ${pres.empresa ?? ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/presupuestos" className="btn-ghost flex items-center gap-2 text-sm">
              <ArrowLeft size={14} /> Volver
            </Link>
            <button onClick={handleSendEmail} disabled={sending}
              className="btn-primary flex items-center gap-2 text-sm">
              {sending ? <Spinner size={14} /> : <Send size={14} />}
              Enviar por email
            </button>
          </div>
        }
      />

      <div className="px-4 md:px-8 pb-10 space-y-5 pt-4 max-w-3xl">

        {msg && (
          <div className={cn('px-4 py-3 rounded-xl text-sm',
            msg.startsWith('✅')
              ? 'text-green-300 bg-green-950/30 border border-green-800/30'
              : 'text-red-300 bg-red-950/30 border border-red-800/30')}>
            {msg}
          </div>
        )}

        {/* Estado y acciones */}
        <div className="flux-card flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className={cn('px-3 py-1.5 rounded-lg text-sm font-bold', est.color)}>
              {est.label}
            </span>
            <span className="text-xs text-flux-text3">
              Creado: {format(toDate(pres.creadoEn), "d 'de' MMMM yyyy", { locale: es })}
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {pres.estado !== 'aceptado' && (
              <button onClick={() => changeEstado('aceptado')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-flux-tealGlow text-flux-teal border border-flux-teal/30 hover:bg-flux-teal hover:text-flux-bg transition-all">
                <CheckCircle size={12} /> Marcar aceptado
              </button>
            )}
            {pres.estado !== 'rechazado' && (
              <button onClick={() => changeEstado('rechazado')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-950/40 text-red-400 border border-red-800/30 hover:bg-red-500 hover:text-white transition-all">
                <XCircle size={12} /> Rechazado
              </button>
            )}
            {pres.estado === 'borrador' && (
              <button onClick={() => changeEstado('enviado')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-950/40 text-blue-400 border border-blue-800/30">
                <Mail size={12} /> Marcar enviado
              </button>
            )}
          </div>
        </div>

        {/* Datos cliente */}
        <div className="flux-card grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-2">Cliente</p>
            <p className="font-bold text-flux-white">{pres.clienteNombre}</p>
            {pres.empresa    && <p className="text-sm text-flux-text2">{pres.empresa}</p>}
            {pres.clienteEmail && <p className="text-sm text-flux-teal">{pres.clienteEmail}</p>}
            {pres.clienteTel   && <p className="text-xs text-flux-text3">{pres.clienteTel}</p>}
          </div>
          <div>
            <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest mb-2">Presupuesto</p>
            <p className="font-bold text-flux-white font-mono">{pres.numero}</p>
            <p className="text-xs text-flux-text3">Válido {pres.validezDias} días</p>
            <p className="text-xs text-flux-text3">Moneda: {pres.moneda}</p>
          </div>
        </div>

        {/* Items */}
        <div className="flux-card">
          <h2 className="text-sm font-semibold text-flux-text1 mb-4 pb-3 border-b border-flux-border">
            Ítems — {pres.totalHoras}h estimadas
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-flux-border">
                {['Descripción', 'Horas', 'Valor/hora', 'Subtotal'].map(h => (
                  <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest py-2 pr-4 last:text-right">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pres.items.map((item, i) => (
                <tr key={i} className="border-b border-flux-border/30">
                  <td className="py-3 pr-4 text-flux-text1">{item.descripcion}</td>
                  <td className="py-3 pr-4 text-flux-text2 text-center">{item.horas}h</td>
                  <td className="py-3 pr-4 text-flux-text2 text-right">${item.valorHora.toLocaleString('es-AR')}</td>
                  <td className="py-3 font-medium text-flux-teal text-right">${item.subtotal.toLocaleString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="flux-card">
          <div className="space-y-2 text-sm max-w-xs ml-auto">
            <div className="flex justify-between py-1.5 border-b border-flux-border/50">
              <span className="text-flux-text3">Subtotal</span>
              <span>${pres.subtotal.toLocaleString('es-AR')}</span>
            </div>
            {pres.descuento > 0 && (
              <div className="flex justify-between py-1.5 border-b border-flux-border/50 text-green-400">
                <span>Descuento ({pres.descuento}%)</span>
                <span>- ${pres.descuentoMonto?.toLocaleString('es-AR') ?? 0}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-flux-border/50">
              <span className="text-flux-text3">IVA ({pres.iva}%)</span>
              <span>${pres.ivaMonto?.toLocaleString('es-AR') ?? 0}</span>
            </div>
            <div className="flex justify-between py-3 px-4 bg-flux-tealGlow rounded-xl font-bold">
              <span className="text-flux-teal text-base">TOTAL</span>
              <span className="text-flux-teal text-xl">
                {pres.moneda === 'USD' ? 'USD ' : '$'}{pres.total.toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        </div>

        {/* Condiciones */}
        {pres.condiciones && (
          <div className="flux-card">
            <h2 className="text-xs font-bold text-flux-text3 uppercase tracking-widest mb-3">Condiciones comerciales</h2>
            <pre className="text-xs text-flux-text2 whitespace-pre-wrap font-sans leading-relaxed">{pres.condiciones}</pre>
          </div>
        )}
      </div>
    </div>
  )
}
