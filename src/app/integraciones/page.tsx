'use client'

import { useState, useEffect } from 'react'
import { useAuthContext }      from '@/components/auth/AuthProvider'
import { AppShell }            from '@/components/layout/AppShell'
import { PageHeader }          from '@/components/layout/PageHeader'
import { Spinner }             from '@/components/ui'
import { getAuthUrl, isGoogleConnected } from '@/lib/google/oauth'
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
          <div className="w-4 h-4"><Spinner size={14} /></div>
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
          <button onClick={action} className={cn(
            'text-xs py-1.5 px-3 rounded-lg font-medium transition-all flex items-center gap-1.5',
            connected
              ? 'btn-ghost'
              : 'btn-primary'
          )}>
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

// ── Export button ─────────────────────────────────────────
function ExportCard({ uid, googleConnected }: { uid: string; googleConnected: boolean }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [result,  setResult]  = useState<{ tipo: string; url: string } | null>(null)

  async function handleExport(tipo: 'leads' | 'oportunidades' | 'clientes') {
    setLoading(tipo)
    setResult(null)
    try {
      const res  = await fetch('/api/sheets/export', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid, tipo }),
      })
      const data = await res.json()
      if (data.success) setResult({ tipo, url: data.url })
      else alert(`Error: ${data.error}`)
    } finally {
      setLoading(null)
    }
  }

  const exports = [
    { tipo: 'leads'          as const, label: 'Leads',         icon: <Download size={12} /> },
    { tipo: 'oportunidades'  as const, label: 'Pipeline',      icon: <Download size={12} /> },
    { tipo: 'clientes'       as const, label: 'Clientes',      icon: <Download size={12} /> },
  ]

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
            {exports.map(({ tipo, label, icon }) => (
              <button key={tipo} onClick={() => handleExport(tipo)}
                disabled={!!loading}
                className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                {loading === tipo
                  ? <Spinner size={12} />
                  : icon}
                {label}
              </button>
            ))}
          </div>

          {result && (
            <div className="mt-3 flex items-center gap-2 text-xs text-flux-success">
              <CheckCircle size={12} />
              Exportado correctamente —{' '}
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

// ── Main page ─────────────────────────────────────────────
export default function IntegracionesPage() {
  const { user, profile } = useAuthContext()
  const [googleOk, setGoogleOk] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    isGoogleConnected(user.uid).then(setGoogleOk)
  }, [user])

  // Check URL params for OAuth result
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
    // Pass uid as state for OAuth callback
    const baseUrl = getAuthUrl()
    const url = baseUrl + `&state=${user.uid}`
    window.location.href = url
  }

  return (
    <AppShell>
      <div className="animate-fade-in">
        <PageHeader
          title="Integraciones"
          subtitle="Conecta Fluxtic con tus herramientas de Google Workspace y Slack"
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
                description="Envía emails desde el CRM registrados en el historial del cliente"
                connected={googleOk}
                action={handleConnectGoogle}
                actionLabel={googleOk ? 'Reconectar' : 'Conectar Google'}
              />

              <IntegrationCard
                icon={<Calendar size={18} />}
                title="Google Calendar"
                description="Crea reuniones y eventos vinculados a clientes y oportunidades"
                connected={googleOk}
                action={handleConnectGoogle}
                actionLabel={googleOk ? 'Reconectar' : 'Conectar Google'}
              />

              {user && (
                <ExportCard uid={user.uid} googleConnected={googleOk ?? false} />
              )}

              <IntegrationCard
                icon={<ExternalLink size={18} />}
                title="Formulario de captación"
                description="Embebe el formulario en tu web para capturar leads automáticamente"
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

          {/* Slack */}
          <div>
            <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">
              Notificaciones
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flux-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-flux-muted flex items-center justify-center text-flux-teal">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium text-flux-text1 text-sm">Slack</h3>
                    <p className="text-2xs text-flux-text3">
                      Alertas de leads, oportunidades, abonos y tareas
                    </p>
                  </div>
                  <div className={cn(
                    'ml-auto flex items-center gap-1.5 text-xs',
                    process.env.NEXT_PUBLIC_SLACK_CONFIGURED === 'true'
                      ? 'text-flux-success'
                      : 'text-flux-text3'
                  )}>
                    {process.env.NEXT_PUBLIC_SLACK_CONFIGURED === 'true'
                      ? <><CheckCircle size={13} /> Activo</>
                      : <><XCircle size={13} /> Sin configurar</>}
                  </div>
                </div>
                <p className="text-xs text-flux-text3 leading-relaxed">
                  Configura <code className="bg-flux-muted px-1 py-0.5 rounded text-flux-teal">SLACK_WEBHOOK_URL</code> en
                  las variables de entorno de Vercel para activar las notificaciones.
                  <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer"
                    className="text-flux-teal hover:underline ml-1 inline-flex items-center gap-0.5">
                    Ver guía <ExternalLink size={10} />
                  </a>
                </p>
              </div>

              <div className="flux-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-flux-muted flex items-center justify-center text-flux-teal">
                    <Zap size={18} />
                  </div>
                  <div>
                    <h3 className="font-medium text-flux-text1 text-sm">n8n (automatizaciones)</h3>
                    <p className="text-2xs text-flux-text3">Flujos automáticos entre herramientas</p>
                  </div>
                </div>
                <p className="text-xs text-flux-text3 leading-relaxed mb-3">
                  Instala n8n en Railway para conectar el CRM con WhatsApp, Gmail, Slack y más
                  sin código adicional.
                </p>
                <a href="https://railway.app/new/template/n8n" target="_blank" rel="noopener noreferrer"
                  className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5 w-fit">
                  <ExternalLink size={12} /> Instalar n8n en Railway
                </a>
              </div>
            </div>
          </div>

          {/* Email composer test */}
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
    </AppShell>
  )
}

// ── Quick email composer ──────────────────────────────────
function EmailComposer({ uid }: { uid: string }) {
  const [to,      setTo]      = useState('')
  const [subject, setSubject] = useState('')
  const [body,    setBody]    = useState('')
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  async function handleSend() {
    if (!to || !subject || !body) return
    setSending(true)
    setError('')
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
      } else {
        setError(data.error ?? 'Error al enviar')
      }
    } finally {
      setSending(false)
    }
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
          placeholder="Cuerpo del email (HTML permitido)…"
          value={body} onChange={e => setBody(e.target.value)} />
        {error && <p className="text-xs text-flux-danger">{error}</p>}
        <button onClick={handleSend} disabled={sending || !to || !subject || !body}
          className="btn-primary text-sm flex items-center gap-2">
          {sending
            ? <><Spinner size={14} /> Enviando…</>
            : sent
            ? <><CheckCircle size={14} /> Enviado</>
            : <><Mail size={14} /> Enviar</>}
        </button>
      </div>
    </div>
  )
}
