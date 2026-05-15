export type Rol = 'OWNER' | 'ADMIN' | 'EMPLEADA'

export interface Permisos {
  puede_ver_caja: boolean
  puede_cobrar: boolean
  puede_anular_ventas: boolean
  puede_reimprimir_comprobantes: boolean
  puede_ver_ventas_dia: boolean
  puede_ver_reportes: boolean
  puede_gestionar_turnos: boolean
  puede_gestionar_clientes: boolean
  puede_gestionar_servicios: boolean
  puede_gestionar_productos: boolean
  puede_gestionar_configuracion: boolean
  puede_gestionar_usuarios: boolean
  puede_gestionar_integraciones: boolean
}

export const PERMISOS_DEFAULT: Permisos = {
  puede_ver_caja: false,
  puede_cobrar: false,
  puede_anular_ventas: false,
  puede_reimprimir_comprobantes: false,
  puede_ver_ventas_dia: false,
  puede_ver_reportes: false,
  puede_gestionar_turnos: true,
  puede_gestionar_clientes: false,
  puede_gestionar_servicios: false,
  puede_gestionar_productos: false,
  puede_gestionar_configuracion: false,
  puede_gestionar_usuarios: false,
  puede_gestionar_integraciones: false,
}

export const PERMISOS_FULL: Permisos = {
  puede_ver_caja: true,
  puede_cobrar: true,
  puede_anular_ventas: true,
  puede_reimprimir_comprobantes: true,
  puede_ver_ventas_dia: true,
  puede_ver_reportes: true,
  puede_gestionar_turnos: true,
  puede_gestionar_clientes: true,
  puede_gestionar_servicios: true,
  puede_gestionar_productos: true,
  puede_gestionar_configuracion: true,
  puede_gestionar_usuarios: true,
  puede_gestionar_integraciones: true,
}

export interface Usuario {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: Rol
  activo: boolean
  color: string
  telefono?: string | null
  createdAt: string
  _count?: {
    turnos: number
  }
  puede_ver_caja?: boolean
  puede_cobrar?: boolean
  puede_anular_ventas?: boolean
  puede_reimprimir_comprobantes?: boolean
  puede_ver_ventas_dia?: boolean
  puede_ver_reportes?: boolean
  puede_gestionar_turnos?: boolean
  puede_gestionar_clientes?: boolean
  puede_gestionar_servicios?: boolean
  puede_gestionar_productos?: boolean
  puede_gestionar_configuracion?: boolean
  puede_gestionar_usuarios?: boolean
  puede_gestionar_integraciones?: boolean
}

export interface CreateUsuarioPayload {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: Rol
  color?: string
  telefono?: string
}

export interface UpdateUsuarioPayload {
  nombre?: string
  apellido?: string
  email?: string
  rol?: Rol
  activo?: boolean
  color?: string
  telefono?: string
  puede_ver_caja?: boolean
  puede_cobrar?: boolean
  puede_anular_ventas?: boolean
  puede_reimprimir_comprobantes?: boolean
  puede_ver_ventas_dia?: boolean
  puede_ver_reportes?: boolean
  puede_gestionar_turnos?: boolean
  puede_gestionar_clientes?: boolean
  puede_gestionar_servicios?: boolean
  puede_gestionar_productos?: boolean
  puede_gestionar_configuracion?: boolean
  puede_gestionar_usuarios?: boolean
  puede_gestionar_integraciones?: boolean
}

export interface CambiarPasswordPayload {
  password_actual?: string
  password_nueva: string
}

export const ROL_LABELS: Record<Rol, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  EMPLEADA: 'Empleada',
}

export const ROL_COLORS: Record<Rol, string> = {
  OWNER: 'vip',
  ADMIN: 'mayor',
  EMPLEADA: 'final',
}

export const COLORES_DISPONIBLES = [
  '#C8A882', '#8BA888', '#D4957A', '#B89860',
  '#9B8BB4', '#7AA5B8', '#B88B8B', '#8BB4A5',
]
