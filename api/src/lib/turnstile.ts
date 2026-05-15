/**
 * Validacion de tokens de Cloudflare Turnstile.
 *
 * El frontend incluye el widget invisible de Turnstile que genera un token.
 * Ese token viaja en el body de la reserva, y aca lo validamos contra los
 * servidores de Cloudflare.
 *
 * Si TURNSTILE_SECRET_KEY no esta seteada en .env, la validacion se omite
 * (modo "dev sin captcha"). En produccion siempre deberia estar.
 *
 * Doc: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */

import { errors } from '../utils/http-errors'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

interface TurnstileResponse {
  success: boolean
  'error-codes'?: string[]
  hostname?: string
  challenge_ts?: string
  action?: string
}

export async function validarTurnstile(token: string | undefined, remoteIp?: string): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Sin secret configurado: skip silencioso (dev / staging sin captcha)
    return
  }
  if (!token) {
    throw errors.badRequest('Falta el token de verificación humana', 'TURNSTILE_FALTANTE')
  }

  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  if (remoteIp) form.set('remoteip', remoteIp)

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json()) as TurnstileResponse

    if (!data.success) {
      const codes = data['error-codes']?.join(',') ?? 'desconocido'
      throw errors.badRequest(
        `Verificación anti-bot rechazada (${codes}). Refrescá la página e intentá de nuevo.`,
        'TURNSTILE_INVALIDO',
      )
    }
  } catch (err) {
    // Si el HttpError ya viene, lo dejamos pasar.
    if (err instanceof Error && (err as { code?: string }).code === 'TURNSTILE_INVALIDO') throw err

    // Si fue timeout / red: fail-open en dev, fail-closed en prod.
    if (process.env.NODE_ENV === 'production') {
      throw errors.serviceUnavailable('No pudimos validar el captcha en este momento. Probá nuevamente.')
    }
  }
}
