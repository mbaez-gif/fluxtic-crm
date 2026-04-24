'use client'

import { useState, useEffect } from 'react'
import { useAuthContext }      from '@/components/auth/AuthProvider'
import { PageHeader }          from '@/components/layout/PageHeader'
import { Spinner }             from '@/components/ui'
import { cn }                  from '@/lib/utils'
import {
  Mail, Calendar, FileSpreadsheet,
  CheckCircle, XCircle, ExternalLink,
  Download, Zap, Bell,
} from 'lucide-react'

// ── Integration card ──────────────────────────────────────
function IntegrationCard({
  icon, title, description, connected, action, actionLabel, secondaryAction, secondaryLabel,
}: {
  icon:             React.ReactNode
  title:            string
  description:      string
  connected:        boolean | null
  action?:          () => void
  actionLabel?:     string
  secondaryAction?: () => void
  secondaryLabel?:  string
}) {
  return (
    <div className="flux-card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-flux-muted flex items-center justify-center text-flux-teal">
            {icon}
          </div>
          <div>
            <h3 className="font-medium text-flux-text1 text-sm">{title}</h3>
            <p className="text-2xs text-flux-text3 mt-0.5">{description}</p>
          </div>
        </div>
        {connected === null ? (
          <Spinner size={14} />
        ) : connected ? (
          <div className="flex items-center gap-1.5 text-xs text-flux-success">
            <CheckCircle size={13} /> Conectado
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-flux-text3">
            <XCircle size={13} /> No conectado
          </div>
        )}
      </div>
      <div className="flex gap-2 flex-wrap">
        {action && actionLabel && (
          <button onClick={action}
            className={cn('text-xs py-1.5 px-3 rounded-lg font-medium transition-all flex items-center gap-1.5',
              connected ? 'btn-ghost' : 'btn-primary')}>
            {actionLabel}
          </button>
        )}
        {secondaryAction && secondaryLabel && connected && (
          <button onClick={secondaryAction} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Export card ───────────────────────────────────────────
function ExportCard({ uid, googleConnected }: { uid: string; googleConnected: boolean }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [result,  setResult]  = useState<{ tipo: string; url: string } | null>(null)
  const [error,   setError]   = useState('')

  async function handleExport(tipo: 'leads' | 'oportunidades' | 'clientes') {
    setLoading(tipo); setResult(null); setError('')
    try {
      const res  = await fetch('/api/sheets/export', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid, tipo }),
      })
      const data = await res.json()
      if (data.success) setResult({ tipo, url: data.url })
      else setError(data.error ?? 'Error exportando')
    } catch { setError('Error de conexión') }
    finally { setLoading(null) }
  }

  return (
    <div className="flux-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-flux-muted flex items-center justify-center text-flux-teal">
          <FileSpreadsheet size={18} />
        </div>
        <div>
          <h3 className="font-medium text-flux-text1 text-sm">Exportar a Google Sheets</h3>
          <p className="text-2xs text-flux-text3">Genera una hoja de cálculo con tus datos</p>
        </div>
      </div>
      {!googleConnected ? (
        <p className="text-xs text-flux-text3">Conecta Google primero para usar esta función.</p>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {(['leads', 'oportunidades', 'clientes'] as const).map(tipo => (
              <button key={tipo} onClick={() => handleExport(tipo)} disabled={!!loading}
                className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 capitalize">
                {loading === tipo ? <Spinner size={12} /> : <Download size={12} />}
                {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-flux-danger">{error}</p>}
          {result && (
            <div className="mt-3 flex items-center gap-2 text-xs text-flux-success">
              <CheckCircle size={12} />
              Exportado —{' '}
              <a href={result.url} target="_blank" rel="noopener noreferrer"
                className="underline flex items-center gap-1">
                Abrir en Sheets <ExternalLink size={10} />
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Email composer ────────────────────────────────────────
function EmailComposer({ uid }: { uid: string }) {
  const [to,      setTo]      = useState('')
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSend() {
    if (!to || !subject || !body) return
    setSending(true); setError('')
    try {
      const res  = await fetch('/api/gmail/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid, to, subject, body }),
      })
      const data = await res.json()
      if (data.success) {
        setSent(true)
        setTo(''); setSubject(''); setBody('')
        setTimeout(() => setSent(false), 3000)
      } else { setError(data.error ?? 'Error al enviar') }
    } catch { setError('Error de conexión') }
    finally { setSending(false) }
  }

  return (
    <div className="flux-card max-w-lg">
      <h3 className="text-sm font-medium text-flux-text1 mb-4 flex items-center gap-2">
        <Mail size={14} className="text-flux-text3" /> Enviar email de prueba
      </h3>
      <div className="space-y-3">
        <input className="flux-input text-sm" placeholder="Para: email@ejemplo.com"
          value={to} onChange={e => setTo(e.target.value)} />
        <input className="flux-input text-sm" placeholder="Asunto"
          value={subject} onChange={e => setSubject(e.target.value)} />
        <textarea rows={4} className="flux-input resize-none text-sm"
          placeholder="Cuerpo del email…"
          value={body} onChange={e => setBody(e.target.value)} />
        {error && <p className="text-xs text-flux-danger">{error}</p>}
        <button onClick={handleSend} disabled={sending || !to || !subject || !body}
          className="btn-primary text-sm flex items-center gap-2">
          {sending ? <><Spinner size={14} /> Enviando…</>
           : sent   ? <><CheckCircle size={14} /> Enviado</>
           :          <><Mail size={14} /> Enviar</>}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function IntegracionesPage() {
  const { user } = useAuthContext()
  const [googleOk, setGoogleOk] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    fetch(`/api/auth/google/status?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => setGoogleOk(d.connected ?? false))
      .catch(() => setGoogleOk(false))
  }, [user])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'google') {
      setGoogleOk(true)
      window.history.replaceState({}, '', '/integraciones')
    }
    if (params.get('error')) {
      alert('Error conectando con Google. Intenta de nuevo.')
      window.history.replaceState({}, '', '/integraciones')
    }
  }, [])

  function handleConnectGoogle() {
    if (!user) return
    window.location.href = `/api/auth/google/start?uid=${user.uid}`
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Integraciones"
        subtitle="Conecta Fluxtic con Google Workspace y Slack"
      />

      <div className="px-8 pb-10 space-y-6">

        {/* Google Workspace */}
        <div>
          <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">
            Google Workspace
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <IntegrationCard
              icon={<Mail size={18} />}
              title="Gmail"
              description="Envía emails desde el CRM registrados en el historial"
              connected={googleOk}
              action={handleConnectGoogle}
              actionLabel={googleOk ? 'Reconectar' : 'Conectar Google'}
            />
            <IntegrationCard
              icon={<Calendar size={18} />}
              title="Google Calendar"
              description="Crea reuniones vinculadas a clientes y oportunidades"
              connected={googleOk}
              action={handleConnectGoogle}
              actionLabel={googleOk ? 'Reconectar' : 'Conectar Google'}
            />
            {user && <ExportCard uid={user.uid} googleConnected={googleOk ?? false} />}
            <IntegrationCard
              icon={<ExternalLink size={18} />}
              title="Formulario de captación"
              description="Captura leads desde tu web automáticamente"
              connected={true}
              action={() => window.open('/formulario', '_blank')}
              actionLabel="Ver formulario"
              secondaryAction={() => {
                navigator.clipboard.writeText(`${window.location.origin}/formulario`)
                alert('URL copiada al portapapeles')
              }}
              secondaryLabel="Copiar URL"
            />
          </div>
        </div>

        {/* Notificaciones */}
        <div>
          <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">
            Notificaciones
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flux-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-flux-muted flex items-center justify-center text-flux-teal">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="font-medium text-flux-text1 text-sm">Slack</h3>
                  <p className="text-2xs text-flux-text3">Alertas de leads, oportunidades y abonos</p>
                </div>
              </div>
              <p className="text-xs text-flux-text3 leading-relaxed">
                Configurá <code className="bg-flux-muted px-1 py-0.5 rounded text-flux-teal">SLACK_WEBHOOK_URL</code> en
                Vercel → Settings → Environment Variables para activar las alertas.
              </p>
              <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer"
                className="mt-3 btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 w-fit">
                <ExternalLink size={12} /> Guía Slack Webhooks
              </a>
            </div>

            <div className="flux-card">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-flux-muted flex items-center justify-center text-flux-teal">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="font-medium text-flux-text1 text-sm">n8n</h3>
                  <p className="text-2xs text-flux-text3">Automatizaciones entre herramientas</p>
                </div>
              </div>
              <p className="text-xs text-flux-text3 leading-relaxed mb-3">
                Instalá n8n en Railway para conectar el CRM con WhatsApp, Gmail y más.
              </p>
              <a href="https://railway.app/new/template/n8n" target="_blank" rel="noopener noreferrer"
                className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 w-fit">
                <ExternalLink size={12} /> Instalar n8n en Railway
              </a>
            </div>
          </div>
        </div>

        {/* Email composer */}
        {googleOk && user && (
          <div>
            <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">
              Probar Gmail
            </h2>
            <EmailComposer uid={user.uid} />
          </div>
        )}
      </div>
    </div>
  )
}
