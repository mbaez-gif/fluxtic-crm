'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthContext }   from '@/components/auth/AuthProvider'
import { useCollection }    from '@/lib/hooks/useCollection'
import { db }               from '@/lib/firebase/config'
import {
  collection, query, where, orderBy,
  onSnapshot, doc, getDoc,
} from 'firebase/firestore'
import { PageHeader }       from '@/components/layout/PageHeader'
import { Spinner }          from '@/components/ui'
import type { WAConversation, WAMessage, WATemplate } from '@/types/whatsapp'
import { WA_TEMPLATES }     from '@/types/whatsapp'
import { cn }               from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { es }               from 'date-fns/locale'
import type { Timestamp }   from 'firebase/firestore'
import {
  MessageCircle, Send, Search, X, CheckCheck,
  Check, Clock, Sparkles, ChevronDown,
  User, Phone, MoreVertical,
} from 'lucide-react'

function toDate(ts: Timestamp | Date | string | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if ((ts as any).toDate) return (ts as any).toDate()
  return new Date()
}

function formatMsgTime(ts: Timestamp | Date | string | undefined): string {
  const d = toDate(ts)
  if (isToday(d))     return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Ayer'
  return format(d, 'd MMM', { locale: es })
}

function StatusIcon({ status }: { status: WAMessage['status'] }) {
  if (status === 'read')      return <CheckCheck size={12} className="text-blue-400" />
  if (status === 'delivered') return <CheckCheck size={12} className="text-flux-text3" />
  if (status === 'sent')      return <Check size={12} className="text-flux-text3" />
  if (status === 'failed')    return <X size={12} className="text-flux-danger" />
  return <Clock size={12} className="text-flux-text3" />
}

// ── Template picker ───────────────────────────────────────
function TemplatePicker({ onSelect, onClose }: {
  onSelect: (t: WATemplate, vars: Record<string, string>) => void
  onClose:  () => void
}) {
  const [selected, setSelected] = useState<WATemplate | null>(null)
  const [vars,     setVars]     = useState<Record<string, string>>({})

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-flux-card border border-flux-border rounded-xl shadow-card-hover overflow-hidden z-10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-flux-border">
        <p className="text-xs font-medium text-flux-text1 flex items-center gap-2">
          <Sparkles size={12} className="text-flux-teal" /> Plantillas de mensaje
        </p>
        <button onClick={onClose}><X size={14} className="text-flux-text3" /></button>
      </div>
      {!selected ? (
        <div className="max-h-60 overflow-y-auto">
          {WA_TEMPLATES.map(t => (
            <button key={t.id} onClick={() => { setSelected(t); setVars({}) }}
              className="w-full text-left px-4 py-3 hover:bg-flux-muted transition-colors border-b border-flux-border/50 last:border-0">
              <p className="text-sm font-medium text-flux-text1">{t.name}</p>
              <p className="text-2xs text-flux-text3 mt-0.5 line-clamp-2">{t.body}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium text-flux-text1">{selected.name}</p>
          <p className="text-xs text-flux-text2 bg-flux-surface rounded-lg px-3 py-2 leading-relaxed">
            {selected.body}
          </p>
          {selected.variables.map(v => (
            <div key={v}>
              <label className="block text-2xs font-medium text-flux-text3 mb-1 capitalize">{v}</label>
              <input className="flux-input text-sm" placeholder={`Valor para {{${v}}}`}
                value={vars[v] ?? ''}
                onChange={e => setVars(prev => ({ ...prev, [v]: e.target.value }))} />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setSelected(null)} className="btn-ghost text-xs py-1.5 flex-1">
              Volver
            </button>
            <button
              onClick={() => { onSelect(selected, vars); onClose() }}
              className="btn-primary text-xs py-1.5 flex-1">
              Usar plantilla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chat view ─────────────────────────────────────────────
function ChatView({ conv }: { conv: WAConversation }) {
  const { profile } = useAuthContext()
  const [messages,      setMessages]      = useState<WAMessage[]>([])
  const [loadingMsgs,   setLoadingMsgs]   = useState(true)
  const [input,         setInput]         = useState('')
  const [sending,       setSending]       = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Real-time messages subscription
  useEffect(() => {
    const q = query(
      collection(db, 'waMessages'),
      where('conversationId', '==', conv.id),
      orderBy('creadoEn', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() }) as WAMessage))
      setLoadingMsgs(false)
    })
    return unsub
  }, [conv.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(
    text?: string,
    templateName?: string,
    templateVars?: Record<string, string>
  ) {
    const body = text ?? input.trim()
    if (!body && !templateName) return
    setSending(true)
    setInput('')
    try {
      await fetch('/api/whatsapp/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to:             conv.contactNumber,
          type:           templateName ? 'template' : 'text',
          body:           templateName ? undefined : body,
          templateName,
          templateVars,
          conversationId: conv.id,
          senderNombre:   profile?.nombre ?? 'Fluxtic',
        }),
      })
    } finally { setSending(false) }
  }

  function handleTemplate(t: WATemplate, vars: Record<string, string>) {
    let body = t.body
    for (const [k, v] of Object.entries(vars)) {
      body = body.replace(`{{${k}}}`, v)
    }
    handleSend(undefined, t.name, vars)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-flux-border bg-flux-surface shrink-0">
        <div className="w-9 h-9 rounded-full bg-green-950 flex items-center justify-center text-green-400 font-bold">
          {conv.contactNombre.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <p className="font-medium text-flux-text1 text-sm">{conv.contactNombre}</p>
          <p className="text-2xs text-flux-text3 flex items-center gap-1">
            <Phone size={9} /> +{conv.contactNumber}
          </p>
        </div>
        <div className="flex gap-1">
          {conv.leadId && (
            <a href="/leads" className="text-2xs text-flux-teal hover:underline">Ver lead</a>
          )}
          {conv.clienteId && (
            <a href="/clientes" className="text-2xs text-flux-teal hover:underline">Ver cliente</a>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loadingMsgs ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-flux-text3 text-sm">
            <MessageCircle size={32} className="mx-auto mb-3 opacity-30" />
            Sin mensajes todavía
          </div>
        ) : (
          messages.map(msg => {
            const isOut = msg.direction === 'outbound'
            return (
              <div key={msg.id} className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-xs px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                  isOut
                    ? 'bg-flux-teal text-flux-bg rounded-tr-sm'
                    : 'bg-flux-card border border-flux-border text-flux-text1 rounded-tl-sm'
                )}>
                  {msg.templateName && (
                    <p className={cn('text-2xs mb-1 flex items-center gap-1', isOut ? 'text-flux-bg/70' : 'text-flux-text3')}>
                      <Sparkles size={9} /> {msg.templateName}
                    </p>
                  )}
                  <p>{msg.body}</p>
                  <div className={cn('flex items-center gap-1 mt-1 justify-end', isOut ? 'text-flux-bg/70' : 'text-flux-text3')}>
                    <span className="text-2xs">{formatMsgTime(msg.creadoEn)}</span>
                    {isOut && <StatusIcon status={msg.status} />}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-flux-border bg-flux-surface shrink-0 relative">
        {showTemplates && (
          <TemplatePicker
            onSelect={handleTemplate}
            onClose={() => setShowTemplates(false)}
          />
        )}
        <div className="flex items-end gap-2">
          <button onClick={() => setShowTemplates(s => !s)}
            className={cn('p-2.5 rounded-xl border transition-all shrink-0',
              showTemplates ? 'bg-flux-tealGlow border-flux-teal text-flux-teal' : 'btn-ghost')}>
            <Sparkles size={16} />
          </button>
          <textarea rows={1} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Escribí un mensaje…"
            className="flux-input flex-1 resize-none text-sm py-2.5"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button onClick={() => handleSend()} disabled={sending || !input.trim()}
            className="btn-primary p-2.5 shrink-0">
            {sending ? <Spinner size={16} /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-2xs text-flux-text3 mt-1.5 text-center">
          Enter para enviar · Shift+Enter para nueva línea · ✨ Plantillas de respuesta
        </p>
      </div>
    </div>
  )
}

// ── Main inbox page ───────────────────────────────────────
export default function WhatsAppPage() {
  const { data: conversations, loading } = useCollection<WAConversation>('waConversations', {
    orderField: 'lastMessageAt',
    orderDir:   'desc',
  })

  const [selected, setSelected] = useState<WAConversation | null>(null)
  const [search,   setSearch]   = useState('')

  const filtered = conversations.filter(c =>
    !search ||
    c.contactNombre.toLowerCase().includes(search.toLowerCase()) ||
    c.contactNumber.includes(search)
  )

  return (
    <div className="animate-fade-in h-[calc(100vh-4rem)] flex flex-col">
      <PageHeader
        title="WhatsApp"
        subtitle={`${conversations.length} conversaciones`}
      />

      <div className="flex flex-1 overflow-hidden mx-8 mb-6 gap-4">
        {/* Conversation list */}
        <div className="w-80 shrink-0 flex flex-col bg-flux-card border border-flux-border rounded-2xl overflow-hidden">
          <div className="p-3 border-b border-flux-border">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3" />
              <input className="flux-input pl-8 text-sm py-2" placeholder="Buscar…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageCircle size={32} className="mx-auto mb-3 text-flux-text3 opacity-30" />
                <p className="text-sm text-flux-text3">
                  {search ? 'Sin resultados' : 'Sin conversaciones todavía'}
                </p>
                {!search && (
                  <p className="text-2xs text-flux-text3 mt-2">
                    Los mensajes entrantes de WhatsApp aparecerán acá
                  </p>
                )}
              </div>
            ) : (
              filtered.map(conv => (
                <button key={conv.id} onClick={() => setSelected(conv)}
                  className={cn(
                    'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-flux-border/50 hover:bg-flux-muted transition-colors',
                    selected?.id === conv.id && 'bg-flux-muted'
                  )}>
                  <div className="w-10 h-10 rounded-full bg-green-950 flex items-center justify-center text-green-400 font-bold shrink-0 mt-0.5">
                    {conv.contactNombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-sm font-medium text-flux-text1 truncate">{conv.contactNombre}</p>
                      <p className="text-2xs text-flux-text3 shrink-0 ml-2">{formatMsgTime(conv.lastMessageAt)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-2xs text-flux-text3 truncate flex-1">{conv.lastMessage}</p>
                      {conv.unreadCount > 0 && (
                        <span className="w-5 h-5 rounded-full bg-green-500 text-white text-2xs flex items-center justify-center shrink-0 ml-2 font-bold">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      'text-2xs px-1.5 py-0.5 rounded-full mt-1 inline-block',
                      conv.status === 'open' ? 'bg-green-950 text-green-400' :
                      conv.status === 'waiting' ? 'bg-amber-950 text-amber-400' :
                      'bg-flux-muted text-flux-text3'
                    )}>
                      {conv.status === 'open' ? 'Abierta' : conv.status === 'waiting' ? 'Esperando' : 'Resuelta'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 bg-flux-card border border-flux-border rounded-2xl overflow-hidden">
          {selected ? (
            <ChatView conv={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-green-950/50 border border-green-800/30 flex items-center justify-center mb-4">
                <MessageCircle size={28} className="text-green-400" />
              </div>
              <p className="font-display font-bold text-flux-white mb-2">WhatsApp Business</p>
              <p className="text-sm text-flux-text3 max-w-xs leading-relaxed">
                Seleccioná una conversación para ver los mensajes o esperá mensajes entrantes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
