'use client'

import { useState, useRef, useEffect } from 'react'
import { Zap, Send, CheckCircle, User, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role:    'user' | 'assistant'
  content: string
}

const INITIAL_MESSAGE: Message = {
  role:    'assistant',
  content: '¡Hola! Soy el asistente de Fluxtic. Estoy aquí para entender cómo podemos ayudarte. ¿Cuál es tu nombre?',
}

export default function CaptacionPage() {
  const [messages,  setMessages]  = useState<Message[]>([INITIAL_MESSAGE])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [leadReady, setLeadReady] = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [leadId,    setLeadId]    = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMsg: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      // Get next bot message
      const res  = await fetch('/api/captacion/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()

      if (data.success) {
        const botMsg: Message = { role: 'assistant', content: data.message }
        const finalMessages   = [...newMessages, botMsg]
        setMessages(finalMessages)

        if (data.leadReady && !saved) {
          setLeadReady(true)
          // Extract and save lead
          const extractRes = await fetch('/api/captacion/extract', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ messages: finalMessages }),
          })
          const extractData = await extractRes.json()
          if (extractData.success) {
            setSaved(true)
            setLeadId(extractData.leadId)
          }
        }
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Disculpá, hubo un error. ¿Podés intentar de nuevo?',
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="min-h-screen bg-flux-bg flex flex-col">

      {/* Header */}
      <div className="border-b border-flux-border bg-flux-surface px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-flux-teal flex items-center justify-center">
            <Zap size={16} className="text-flux-bg" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-display font-bold text-flux-white text-sm">Fluxtic</p>
            <p className="text-2xs text-flux-text3">Asistente comercial · En línea</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Intro card */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-flux-teal/10 border border-flux-teal/20 flex items-center justify-center mx-auto mb-3">
              <Zap size={24} className="text-flux-teal" />
            </div>
            <h1 className="font-display font-bold text-xl text-flux-white mb-1">
              Hablemos de tu proyecto
            </h1>
            <p className="text-sm text-flux-text3">
              Contanos tu situación y te conectamos con el consultor indicado.
            </p>
          </div>

          {messages.map((msg, i) => (
            <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-flux-teal/20 border border-flux-teal/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={14} className="text-flux-teal" />
                </div>
              )}
              <div className={cn(
                'max-w-sm px-4 py-3 rounded-2xl text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-flux-teal text-flux-bg rounded-tr-sm'
                  : 'bg-flux-card border border-flux-border text-flux-text1 rounded-tl-sm'
              )}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-flux-muted flex items-center justify-center shrink-0 mt-0.5">
                  <User size={14} className="text-flux-text2" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-flux-teal/20 border border-flux-teal/30 flex items-center justify-center shrink-0">
                <Bot size={14} className="text-flux-teal" />
              </div>
              <div className="bg-flux-card border border-flux-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-flux-text3 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Lead saved confirmation */}
          {saved && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-sm">
              <CheckCircle size={16} className="text-flux-teal shrink-0" />
              <span className="text-emerald-200">
                ✅ Tu consulta fue registrada. Un consultor de Fluxtic te contactará a la brevedad.
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      {!leadReady && (
        <div className="border-t border-flux-border bg-flux-surface px-4 py-4">
          <div className="max-w-2xl mx-auto flex gap-3">
            <textarea
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
              placeholder="Escribí tu mensaje…"
              className="flex-1 flux-input resize-none text-sm py-2.5"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="btn-primary px-4 flex items-center gap-2 shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
          <p className="text-center text-2xs text-flux-text3 mt-2">
            Asistido por IA · Tus datos están protegidos
          </p>
        </div>
      )}
    </div>
  )
}
