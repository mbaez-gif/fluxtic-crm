'use client'

import { useState, useEffect } from 'react'
import { useAuthContext }      from '@/components/auth/AuthProvider'
import { db }                  from '@/lib/firebase/config'
import {
  collection, query, where, orderBy,
  getDocs, addDoc, serverTimestamp,
} from 'firebase/firestore'
import { cn }    from '@/lib/utils'
import { format } from 'date-fns'
import { es }    from 'date-fns/locale'
import {
  X, Send, Mail, Clock, CheckCircle,
  AlertCircle, ChevronDown, ChevronUp,
  Loader2, Eye, EyeOff, History,
} from 'lucide-react'

interface EmailLog {
  id:            string
  to:            string
  subject:       string
  body:          string
  status:        'sent' | 'error'
  error?:        string
  senderNombre:  string
  leadId?:       string
  clienteId?:    string
  creadoEn:      any
}

interface Props {
  // Target contact
  nombre:     string
  email:      string
  // Link to entity
  leadId?:    string
  clienteId?: string
  // Control
  onClose:    () => void
}

// ── Email templates ───────────────────────────────────────
const TEMPLATES = [
  {
    label:   'Primer contacto',
    subject: 'Fluxtic — Te contactamos',
    body:    (nombre: string) =>
      `Hola ${nombre.split(' ')[0]},\n\nMi nombre es {{tu_nombre}} y te contacto desde Fluxtic, consultora especializada en automatizaciones e integración tecnológica para empresas.\n\nCreemos que podemos ayudarte a digitalizar y optimizar los procesos de tu empresa. ¿Tendrías unos minutos para conversar esta semana?\n\nQuedamos a disposición.\n\nSaludos,\n{{tu_nombre}}\nFluxtic — Automatizaciones Inteligentes`,
  },
  {
    label:   'Seguimiento propuesta',
    subject: 'Seguimiento — Propuesta Fluxtic',
    body:    (nombre: string) =>
      `Hola ${nombre.split(' ')[0]},\n\nTe escribo para hacer seguimiento de la propuesta que te enviamos. ¿Tuviste oportunidad de revisarla?\n\nEstamos disponibles para resolver cualquier duda o ajustar lo que necesites.\n\n¿Podemos agendar una llamada breve esta semana?\n\nSaludos,\n{{tu_nombre}}\nFluxtic`,
  },
  {
    label:   'Reunión agendada',
    subject: 'Confirmación de reunión — Fluxtic',
    body:    (nombre: string) =>
      `Hola ${nombre.split(' ')[0]},\n\nConfirmamos nuestra reunión para el {{fecha}} a las {{hora}}.\n\nLink de videollamada: {{link}}\n\nSi necesitás reagendar, avisanos con anticipación.\n\n¡Hasta pronto!\n\n{{tu_nombre}}\nFluxtic`,
  },
  {
    label:   'Blank',
    subject: '',
    body:    () => '',
  },
]

// ── Email history item ────────────────────────────────────
function EmailHistoryItem({ log, onView }: { log: EmailLog; onView: (log: EmailLog) => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <div className={cn('mt-0.5 shrink-0',
        log.status === 'sent' ? 'text-green-400' : 'text-red-400')}>
        {log.status === 'sent' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-200 truncate">{log.subject || '(sin asunto)'}</p>
        <p className="text-2xs text-slate-500 mt-0.5">
          {log.senderNombre} · {format(log.creadoEn?.toDate?.() ?? new Date(), "d MMM 'a las' HH:mm", { locale: es })}
        </p>
      </div>
      <button onClick={() => onView(log)}
        className="text-slate-500 hover:text-slate-300 p-1 shrink-0">
        <Eye size={12} />
      </button>
    </div>
  )
}

// ── Main composer ─────────────────────────────────────────
export function EmailComposer({ nombre, email, leadId, clienteId, onClose }: Props) {
  const { user, profile } = useAuthContext()

  const [tab,         setTab]         = useState<'compose' | 'history'>('compose')
  const [subject,     setSubject]      = useState('')
  const [body,        setBody]         = useState('')
  const [sending,     setSending]      = useState(false)
  const [sent,        setSent]         = useState(false)
  const [error,       setError]        = useState('')
  const [history,     setHistory]      = useState<EmailLog[]>([])
  const [loadingHist, setLoadingHist]  = useState(false)
  const [viewLog,     setViewLog]      = useState<EmailLog | null>(null)
  const [showTempl,   setShowTempl]    = useState(false)

  // Load email history for this contact
  useEffect(() => {
    if (tab !== 'history') return
    setLoadingHist(true)
    const field = leadId ? 'leadId' : 'clienteId'
    const value = leadId ?? clienteId
    if (!value) { setLoadingHist(false); return }

    const q = query(
      collection(db, 'emailLog'),
      where(field, '==', value),
      orderBy('creadoEn', 'desc')
    )
    getDocs(q).then(snap => {
      setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }) as EmailLog))
      setLoadingHist(false)
    })
  }, [tab, leadId, clienteId])

  function applyTemplate(t: typeof TEMPLATES[0]) {
    setSubject(t.subject)
    setBody(t.body(nombre))
    setShowTempl(false)
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim() || !user) return
    setSending(true)
    setError('')

    try {
      // Get Google tokens
      const { doc: fsDoc, getDoc } = await import('firebase/firestore')
      const tokenSnap = await getDoc(fsDoc(db, 'googleTokens', user.uid))
      if (!tokenSnap.exists()) {
        setError('Conectá tu cuenta de Google en Integraciones antes de enviar emails.')
        setSending(false)
        return
      }
      const tokens = tokenSnap.data()

      const res  = await fetch('/api/gmail/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token:  tokens.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date:   tokens.expiry_date,
          to:            email,
          subject:       subject.trim(),
          body:          body.trim(),
        }),
      })
      const data = await res.json()

      // Save to emailLog
      await addDoc(collection(db, 'emailLog'), {
        to:           email,
        subject:      subject.trim(),
        body:         body.trim(),
        status:       data.success ? 'sent' : 'error',
        error:        data.error ?? null,
        senderUid:    user.uid,
        senderNombre: profile?.nombre ?? 'Fluxtic',
        ...(leadId    && { leadId }),
        ...(clienteId && { clienteId }),
        creadoEn:     serverTimestamp(),
      })

      if (data.success) {
        setSent(true)
        setTimeout(onClose, 2000)
      } else {
        setError(data.error ?? 'Error al enviar el email')
      }
    } catch (err) {
      setError('Error de conexión')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl border border-white/8 flex flex-col overflow-hidden"
        style={{ background: '#0d1829', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Mail size={15} className="text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-200 text-sm">Email a {nombre}</p>
              <p className="text-2xs text-slate-500">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Tabs */}
            <button onClick={() => setTab('compose')}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                tab === 'compose' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300')}>
              Redactar
            </button>
            <button onClick={() => setTab('history')}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1',
                tab === 'history' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-500 hover:text-slate-300')}>
              <History size={11} /> Historial
              {history.length > 0 && (
                <span className="bg-slate-600 text-slate-300 rounded px-1 text-2xs">{history.length}</span>
              )}
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        {tab === 'compose' ? (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Template picker */}
              <div className="relative">
                <button onClick={() => setShowTempl(s => !s)}
                  className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                  <Sparkle size={12} /> Usar plantilla
                  {showTempl ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
                {showTempl && (
                  <div className="absolute top-full left-0 mt-1 z-10 w-64 rounded-xl border border-white/8 overflow-hidden"
                    style={{ background: '#0d1829' }}>
                    {TEMPLATES.map(t => (
                      <button key={t.label} onClick={() => applyTemplate(t)}
                        className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Asunto</label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="Asunto del email"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,176,255,0.5)'}
                  onBlur={e  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Mensaje</label>
                <textarea
                  rows={10}
                  className="w-full px-4 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all resize-none font-mono"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  placeholder="Escribí tu mensaje acá…"
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,176,255,0.5)'}
                  onBlur={e  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-xs text-red-300"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}

              {sent && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs text-green-300"
                  style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <CheckCircle size={13} /> ¡Email enviado! Cerrando…
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/8 flex justify-between items-center shrink-0">
              <p className="text-2xs text-slate-600">
                Se enviará desde tu cuenta de Google conectada
              </p>
              <button
                onClick={handleSend}
                disabled={sending || sent || !subject.trim() || !body.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #00b0ff, #0077cc)', color: '#060910' }}
              >
                {sending ? <><Loader2 size={15} className="animate-spin" /> Enviando…</>
                  : sent  ? <><CheckCircle size={15} /> Enviado</>
                  : <><Send size={15} /> Enviar email</>}
              </button>
            </div>
          </>
        ) : (
          /* History tab */
          <div className="flex-1 overflow-y-auto">
            {viewLog ? (
              <div className="p-5 space-y-4">
                <button onClick={() => setViewLog(null)}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                  ← Volver al historial
                </button>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {viewLog.status === 'sent'
                      ? <CheckCircle size={14} className="text-green-400" />
                      : <AlertCircle size={14} className="text-red-400" />}
                    <p className="text-xs text-slate-400">
                      {viewLog.senderNombre} · {format(viewLog.creadoEn?.toDate?.() ?? new Date(), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                  <p className="font-semibold text-slate-200">{viewLog.subject}</p>
                  <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans bg-white/[0.03] rounded-xl p-4 border border-white/5">
                    {viewLog.body}
                  </pre>
                </div>
              </div>
            ) : loadingHist ? (
              <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-slate-500" /></div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Mail size={28} className="text-slate-600" />
                <p className="text-sm text-slate-500">Sin emails enviados a este contacto</p>
              </div>
            ) : (
              <div>
                {history.map(log => (
                  <EmailHistoryItem key={log.id} log={log} onView={setViewLog} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Small icon component used above
function Sparkle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0l1.5 5.5L15 7l-5.5 1.5L8 14l-1.5-5.5L1 7l5.5-1.5z" />
    </svg>
  )
}
