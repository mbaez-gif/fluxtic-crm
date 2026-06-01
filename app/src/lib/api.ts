// app/src/lib/api.ts
// Cliente centralizado para llamadas a la API Fastify de Fluxtic Salud.
//
// Auth automático:
//   - En el browser, lee el `apiToken` de la sesión NextAuth (via getSession)
//     y lo agrega como `Authorization: Bearer <token>` salvo que el caller
//     pase `auth: false` para llamadas explícitamente públicas (ej. /reservar).
//   - En SSR/Server Components, NO inyecta token (usar opts.token explícito si hace falta).
//
// Manejo de 401:
//   - Si el backend devuelve 401, dispara signOut() automáticamente
//     y redirige a /login (solo en el browser).

import { getSession, signOut } from 'next-auth/react'

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
  }
  return process.env.INTERNAL_API_URL || 'http://api-salud:3001'
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  token?: string
  /** Si es true (default), agrega Authorization desde la sesión. Poné false para endpoints públicos. */
  auth?: boolean
}

// Cache de token a nivel módulo para evitar getSession() en cada call.
// Se invalida tras 401.
let cachedToken: string | null | undefined
async function resolveAuthToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  if (cachedToken !== undefined) return cachedToken ?? null
  try {
    const session: any = await getSession()
    cachedToken = session?.apiToken ?? null
    return cachedToken ?? null
  } catch {
    cachedToken = null
    return null
  }
}

/** Limpia el cache de token. Llamar tras signIn/signOut. */
export function clearAuthCache() {
  cachedToken = undefined
}

export async function apiFetch<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const base = getApiUrl()
  const { body, token, headers, auth = true, ...rest } = opts

  // Resolver token: explícito > sesión NextAuth > ninguno
  let bearer: string | null = token ?? null
  if (!bearer && auth) {
    bearer = await resolveAuthToken()
  }

  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })

  if (!res.ok) {
    // 401: sesión inválida o expirada → invalidar cache + redirigir a login (solo browser)
    if (res.status === 401 && typeof window !== 'undefined' && auth) {
      clearAuthCache()
      // Evitar loop si ya estamos en /login
      if (!window.location.pathname.startsWith('/login')) {
        signOut({ callbackUrl: `/login?from=${encodeURIComponent(window.location.pathname)}` })
      }
    }
    const text = await res.text().catch(() => '')
    const err: any = new Error(`API ${res.status} ${path}${text ? `: ${text}` : ''}`)
    err.status = res.status
    throw err
  }
  if (res.status === 204) return undefined as unknown as T
  return (await res.json()) as T
}

export const api = {
  get:    <T = unknown>(path: string, opts?: ApiOptions) => apiFetch<T>(path, { ...opts, method: 'GET' }),
  post:   <T = unknown>(path: string, body?: unknown, opts?: ApiOptions) => apiFetch<T>(path, { ...opts, method: 'POST', body }),
  patch:  <T = unknown>(path: string, body?: unknown, opts?: ApiOptions) => apiFetch<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, body?: unknown, opts?: ApiOptions) => apiFetch<T>(path, { ...opts, method: 'DELETE', body }),
}
