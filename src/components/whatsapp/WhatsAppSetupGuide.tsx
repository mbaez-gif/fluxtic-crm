'use client'

import { useState } from 'react'
import { cn }       from '@/lib/utils'
import {
  MessageCircle, CheckCircle, Copy, ExternalLink,
  ChevronDown, ChevronUp, AlertTriangle,
} from 'lucide-react'

export function WhatsAppSetupGuide() {
  const [open, setOpen] = useState(false)
  const waWebhookUrl    = typeof window !== 'undefined'
    ? `${window.location.origin}/api/whatsapp/webhook`
    : 'https://fluxtic-crm.vercel.app/api/whatsapp/webhook'

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
  }

  const steps = [
    {
      num:   '01',
      title: 'Crear cuenta Meta Business',
      desc:  'Ir a business.facebook.com y crear o verificar tu cuenta de empresa.',
      link:  'https://business.facebook.com',
    },
    {
      num:   '02',
      title: 'Crear app en Meta for Developers',
      desc:  'Ir a developers.facebook.com → Create App → Business → agregar WhatsApp.',
      link:  'https://developers.facebook.com',
    },
    {
      num:   '03',
      title: 'Configurar número de WhatsApp',
      desc:  'En el panel de WhatsApp → Phone Numbers → agregar número dedicado (no puede ser el personal).',
    },
    {
      num:   '04',
      title: 'Configurar webhook',
      desc:  'En WhatsApp → Configuration → Webhook. Pegá la URL y el Verify Token.',
      code:  waWebhookUrl,
    },
    {
      num:   '05',
      title: 'Agregar variables en Vercel',
      desc:  'Ir a Vercel → Settings → Environment Variables y agregar:',
      vars:  ['WA_PHONE_NUMBER_ID', 'WA_ACCESS_TOKEN', 'WA_VERIFY_TOKEN=fluxtic_verify_2026'],
    },
    {
      num:   '06',
      title: 'Redeploy y probar',
      desc:  'Hacer Redeploy en Vercel y enviar un mensaje al número configurado.',
    },
  ]

  return (
    <div className="flux-card border-green-800/30">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-950/50 flex items-center justify-center">
            <MessageCircle size={18} className="text-green-400" />
          </div>
          <div className="text-left">
            <p className="font-medium text-flux-text1 text-sm">WhatsApp Business API</p>
            <p className="text-2xs text-flux-text3">Meta Cloud API directo — sin costo fijo</p>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-flux-text3" /> : <ChevronDown size={16} className="text-flux-text3" />}
      </button>

      {open && (
        <div className="mt-5 space-y-4 border-t border-flux-border pt-5">
          <div className="flex items-start gap-2 px-3 py-3 bg-amber-950/30 border border-amber-800/30 rounded-xl">
            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Para producción necesitás un número de teléfono dedicado (no puede ser tu número personal de WhatsApp). 
              El costo es solo por conversaciones: ~$0.027 USD cada una, las primeras 1.000/mes son gratis.
            </p>
          </div>

          <div className="space-y-3">
            {steps.map(step => (
              <div key={step.num} className="flex gap-4">
                <div className="w-8 h-8 rounded-lg bg-green-950/50 border border-green-800/30 flex items-center justify-center text-xs font-bold text-green-400 shrink-0">
                  {step.num}
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-sm font-medium text-flux-text1">{step.title}</p>
                  <p className="text-xs text-flux-text3 mt-0.5 leading-relaxed">{step.desc}</p>
                  {step.link && (
                    <a href={step.link} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-flux-teal hover:underline flex items-center gap-1 mt-1">
                      <ExternalLink size={10} /> Ir al sitio
                    </a>
                  )}
                  {step.code && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-flux-surface border border-flux-border rounded-lg">
                      <code className="text-xs text-flux-teal flex-1 break-all">{step.code}</code>
                      <button onClick={() => copyToClipboard(step.code!)}
                        className="text-flux-text3 hover:text-flux-text1 shrink-0">
                        <Copy size={12} />
                      </button>
                    </div>
                  )}
                  {step.vars && (
                    <div className="mt-2 space-y-1">
                      {step.vars.map(v => (
                        <div key={v} className="flex items-center gap-2 px-3 py-1.5 bg-flux-surface border border-flux-border rounded-lg">
                          <code className="text-xs text-flux-teal flex-1">{v}</code>
                          <button onClick={() => copyToClipboard(v.split('=')[0])}
                            className="text-flux-text3 hover:text-flux-text1">
                            <Copy size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 px-3 py-3 bg-flux-tealGlow/10 border border-flux-teal/20 rounded-xl">
            <CheckCircle size={14} className="text-flux-teal shrink-0" />
            <p className="text-xs text-flux-text2 leading-relaxed">
              Una vez configurado, los mensajes de WhatsApp entrantes aparecerán en tiempo real en <strong className="text-flux-text1">CRM → WhatsApp</strong>.
              Podés responder desde el CRM y usar las plantillas predefinidas.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
