'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: GoogleInitOpts) => void
          renderButton: (el: HTMLElement, opts: GoogleButtonOpts) => void
          prompt: () => void
        }
      }
    }
  }
}

interface GoogleInitOpts {
  client_id: string
  callback: (resp: { credential: string }) => void
  auto_select?: boolean
  cancel_on_tap_outside?: boolean
}

interface GoogleButtonOpts {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  width?: number
  logo_alignment?: 'left' | 'center'
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const LOG = '[GoogleAutofill]'

interface JwtClaims {
  name?: string
  given_name?: string
  family_name?: string
  email?: string
  email_verified?: boolean
  picture?: string
}

interface Props {
  clientId: string
  onProfile: (p: { nombre: string; apellido: string; email: string }) => void
}

/**
 * Boton "Continuar con Google". Al loguear, decodifica el JWT que devuelve
 * Google Identity Services y rellena nombre / apellido / email en el wizard.
 * NO crea sesion en el CRM ni intercambia tokens con el backend.
 *
 * Para que funcione necesita:
 *   1. NEXT_PUBLIC_GOOGLE_CLIENT_ID seteado en BUILD TIME (no runtime).
 *      Pasa por build args en docker-compose -> Dockerfile.
 *   2. El dominio actual estar agregado en "Authorized JavaScript origins"
 *      del OAuth Client en Google Cloud Console.
 *
 * Si clientId esta vacio, no renderiza nada.
 */
export default function GoogleAutofill({ clientId, onProfile }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!clientId) {
      console.warn(`${LOG} NEXT_PUBLIC_GOOGLE_CLIENT_ID vacío — botón Google desactivado. Verificá que el docker compose pase la build arg correctamente.`)
      return
    }
    if (!ref.current) return

    let cancelled = false

    function init() {
      if (cancelled || !ref.current) return
      if (!window.google?.accounts?.id) {
        console.error(`${LOG} window.google.accounts.id no disponible. ¿Bloqueado por adblock o CSP?`)
        return
      }
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (resp) => {
            if (!resp?.credential) {
              console.error(`${LOG} Callback sin credential. Resp:`, resp)
              return
            }
            try {
              const claims = decodeJwt(resp.credential)
              const fullName = (claims.name ?? '').trim()
              const givenFromClaims = (claims.given_name ?? '').trim()
              const familyFromClaims = (claims.family_name ?? '').trim()

              let nombre = givenFromClaims
              let apellido = familyFromClaims
              if (!nombre && !apellido && fullName) {
                const partes = fullName.split(/\s+/)
                nombre = partes[0] ?? ''
                apellido = partes.slice(1).join(' ') ?? ''
              }
              if (!nombre) nombre = fullName

              const email = (claims.email ?? '').trim()
              if (!email) {
                console.warn(`${LOG} JWT no incluyó email. claims:`, claims)
              }

              onProfile({ nombre, apellido, email })
              console.info(`${LOG} Autocompletado OK con ${email || '(sin email)'}.`)
            } catch (err) {
              console.error(`${LOG} Falla parseando credential JWT:`, err)
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })
        window.google.accounts.id.renderButton(ref.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 320,
          logo_alignment: 'left',
        })
      } catch (err) {
        console.error(`${LOG} Falla inicializando Google Identity Services:`, err)
      }
    }

    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`) as HTMLScriptElement | null
    if (window.google?.accounts?.id) {
      init()
    } else if (existing) {
      existing.addEventListener('load', init)
      existing.addEventListener('error', () => {
        console.error(`${LOG} Falla cargando ${SCRIPT_SRC}. Revisá conectividad o adblock.`)
      })
    } else {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = init
      script.onerror = () => {
        console.error(`${LOG} Falla cargando ${SCRIPT_SRC}. Revisá conectividad o adblock.`)
      }
      document.head.appendChild(script)
    }

    return () => { cancelled = true }
  }, [clientId, onProfile])

  if (!clientId) return null

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
      <div ref={ref} />
    </div>
  )
}

/**
 * Decodifica el payload de un JWT (sin validar la firma — solo lectura local
 * para pre-rellenar campos). La autoridad real del email viene en email_verified.
 */
function decodeJwt(token: string): JwtClaims {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT: must have 3 parts')
  const padded = parts[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const padding = (4 - (padded.length % 4)) % 4
  return JSON.parse(atob(padded + '='.repeat(padding)))
}
