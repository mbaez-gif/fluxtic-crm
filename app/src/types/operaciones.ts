// ── Servicios ────────────────────────────────────────────────────
export type CategoriaServicio = 'MANOS_PIES' | 'CEJAS_PESTANAS' | 'LABIOS' | 'FACIAL' | 'OTRO'

export const CATEGORIA_SERVICIO_LABELS: Record<CategoriaServicio, string> = {
  MANOS_PIES: 'Manos y pies',
  CEJAS_PESTANAS: 'Cejas y pestañas',
  LABIOS: 'Labios',
  FACIAL: 'Facial',
  OTRO: 'Otro',
}

export const CATEGORIA_SERVICIO_EMOJIS: Record<CategoriaServicio, string> = {
  MANOS_PIES: '💅',
  CEJAS_PESTANAS: '✨',
  LABIOS: '💋',
  FACIAL: '🌸',
  OTRO: '🎨',
}

export interface Servicio {
  id: string
  nombre: string
  descripcion?: string | null
  categoria: CategoriaServicio
  duracion_min: number
  precio: number
  foto_url?: string | null
  activo: boolean
  createdAt: string
  _count?: { turnos: number }
}

// ── Productos ─────────────────────────────────────────────────────
export type CategoriaProducto = 'INSUMO' | 'MARCA_PROPIA' | 'REVENTA'

export const CATEGORIA_PRODUCTO_LABELS: Record<CategoriaProducto, string> = {
  INSUMO: 'Insumo',
  MARCA_PROPIA: 'Marca propia',
  REVENTA: 'Reventa',
}

export interface Producto {
  id: string
  nombre: string
  sku?: string | null
  categoria: CategoriaProducto
  precio_minorista: number
  precio_mayorista?: number | null
  stock_actual: number
  stock_minimo: number
  foto_url?: string | null
  tiendanube_prod_id?: string | null
  activo: boolean
  createdAt?: string
  estado?: 'OK' | 'BAJO' | 'CRITICO'
}

// ── Ventas / Caja ─────────────────────────────────────────────────
export type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO' | 'CREDITO' | 'MERCADOPAGO'

export const MEDIO_PAGO_LABELS: Record<MedioPago, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  MERCADOPAGO: 'MercadoPago',
}

export interface ItemCarrito {
  tipo: 'SERVICIO' | 'PRODUCTO'
  id: string
  nombre: string
  cantidad: number
  precio_unitario: number
}

export interface Venta {
  id: string
  cliente_id?: string | null
  profesional_id?: string | null
  medio_pago: MedioPago
  subtotal: number
  descuento: number
  total: number
  notas?: string | null
  createdAt: string
  cliente?: { id: string; nombre: string; apellido: string } | null
  profesional?: { id: string; nombre: string; apellido: string } | null
  items: ItemVenta[]
}

export interface ItemVenta {
  id: string
  tipo: string
  referencia_id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
