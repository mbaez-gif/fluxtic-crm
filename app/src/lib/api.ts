// app/src/lib/api.ts
// Cliente centralizado para llamadas a la API Fastify
//
// Server Components  → INTERNAL_API_URL  (http://api-delfina:3001)
// Client Components  → NEXT_PUBLIC_API_URL (https://api-delfina.fluxtic.com)

function getApiUrl(): string {
  // En el browser siempre usamos la URL pública
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com'
  }
  // En el servidor (SSR / Server Components) usamos la URL interna de Docker
  return process.env.INTERNAL_API_URL || 'http://api-delfina:3001'
}

// ── Tipos para el dashboard ───────────────────────────────────────

export interface TurnoDashboard {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  duracion_min: number
  estado: string
  precio: number
  senia?: number | null
  notas?: string | null
  cliente: {
    id: string
    nombre: string
    apellido: string
    telefono: string
    segmento: string
  }
  servicio: {
    id: string
    nombre: string
    categoria: string
    duracion_min: number
    precio: number
  }
  profesional: {
    id: string
    nombre: string
    apellido: string
  }
}

export interface ProductoDashboard {
  id: string
  nombre: string
  sku: string | null
  categoria: string
  stock_actual: number
  stock_minimo: number
  precio_minorista: string | null
  precio_mayorista: string | null
  activo: boolean
}

// ── Cliente genérico ──────────────────────────────────────────────

export async function apiClient<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiUrl()
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status} en ${path}${text ? ': ' + text : ''}`)
  }

  return res.json() as Promise<T>
}

// ── Funciones del dashboard ───────────────────────────────────────

export async function getTurnosHoy(): Promise<TurnoDashboard[]> {
  const hoy = new Date().toISOString().split('T')[0]
  const res = await apiClient<{ data: TurnoDashboard[]; total: number }>(
    `/turnos?fecha=${hoy}`
  )
  return res.data
}

export async function getStockBajoMinimo(): Promise<ProductoDashboard[]> {
  return apiClient<ProductoDashboard[]>('/stock/bajo-minimo')
}

export async function getClientesCount(): Promise<number> {
  const res = await apiClient<{ total: number }>('/clientes?limit=1')
  return res.total
}

export async function getProductos(): Promise<ProductoDashboard[]> {
  return apiClient<ProductoDashboard[]>('/productos')
}
