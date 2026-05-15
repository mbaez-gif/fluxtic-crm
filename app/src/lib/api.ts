// app/src/lib/api.ts
// Cliente centralizado para llamadas a la API Fastify de Fluxtic Salud.

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
  }
  return process.env.INTERNAL_API_URL || 'http://api-salud:3001'
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  token?: string
}

export async function apiFetch<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const base = getApiUrl()
  const { body, token, headers, ...rest } = opts
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
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
