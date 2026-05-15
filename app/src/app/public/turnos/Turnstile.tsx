'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: string | HTMLElement, opts: TurnstileOptions) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
    onloadTurnstileCallback?: () => void
  }
}

interface TurnstileOptions {
  sitekey: string
  callback?: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
  size?: 'normal' | 'compact' | 'invisible' | 'flexible'
  theme?: 'light' | 'dark' | 'auto'
  appearance?: 'always' | 'execute' | 'interaction-only'
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface Props {
  siteKey: string
  onToken: (token: string) => void
  onError?: () => void
}

/**
 * Widget de Cloudflare Turnstile invisible.
 * Renderiza el challenge automaticamente al montar y notifica el token via onToken.
 * Si el siteKey esta vacio, no renderiza nada (modo dev sin captcha).
 */
export default function Turnstile({ siteKey, onToken, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!siteKey) return
    if (!ref.current) return

    let cancelled = false

    function render() {
      if (cancelled || !ref.current || !window.turnstile) return
      try {
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: token => onToken(token),
          'error-callback': () => onError?.(),
          'expired-callback': () => onError?.(),
          appearance: 'interaction-only',
          theme: 'light',
        })
      } catch { /* ignore */ }
    }

    // Cargar el script si todavia no esta
    const existing = document.querySelector(`script[src^="${SCRIPT_SRC.split('?')[0]}"]`)
    if (window.turnstile) {
      render()
    } else if (existing) {
      existing.addEventListener('load', render)
    } else {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = render
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* ignore */ }
      }
    }
  }, [siteKey, onToken, onError])

  if (!siteKey) return null
  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }} />
}
