// app/src/types/index.ts

export type RolUsuario = 'OWNER' | 'ADMIN' | 'EMPLEADA'

export type EstadoTurno =
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'EN_CURSO'
  | 'COMPLETADO'
  | 'CANCELADO'
  | 'NO_SHOW'

export type Segmento = 'FINAL' | 'MAYORISTA' | 'VIP'

export type CategoriaProducto = 'INSUMO' | 'MARCA_PROPIA' | 'REVENTA'

export interface Turno {
  id:          string
  fecha:       string
  duracion_min: number
  precio:      string
  estado:      EstadoTurno
  notas?:      string | null
  cliente: {
    id:       string
    nombre:   string
    apellido: string | null
    telefono: string | null
  }
  servicio: {
    id:           string
    nombre:       string
    duracion_min: number
    categoria:    string
  }
  profesional: {
    id:       string
    nombre:   string
    apellido: string | null
  }
}

export interface Cliente {
  id:            string
  nombre:        string
  apellido:      string | null
  telefono:      string | null
  email:         string | null
  segmento:      Segmento
  origen:        string
  total_compras: string
  cant_turnos:   number
  ultimo_turno:  string | null
  activo:        boolean
  createdAt:     string
}

export interface Producto {
  id:               string
  nombre:           string
  sku:              string | null
  categoria:        CategoriaProducto
  stock_actual:     number
  stock_minimo:     number
  precio_minorista: string
  precio_mayorista: string | null
  activo:           boolean
}
