/**
 * Matriz de permisos por rol — fuente unica de verdad.
 *
 * Espejo en cliente: app/src/lib/permissions.ts (regenerar manualmente al
 * editar este archivo, hasta tener un build step que lo sincronice).
 *
 * Convencion: <recurso>:<accion>
 *   - acciones: ver | crear | editar | eliminar
 *   - acciones propias: ver_propia | editar_propia (limitado a registros del propio profesional/paciente)
 *
 * El comodin '*' otorga acceso total.
 */

import type { RolUsuario } from '@prisma/client'

export type Permiso = string

export const POLICIES: Record<RolUsuario, Permiso[]> = {
  ADMIN_GENERAL: ['*'],

  COORDINADOR_MEDICO: [
    'paciente:ver', 'paciente:crear', 'paciente:editar',
    'profesional:ver', 'profesional:editar',
    'agenda:ver', 'agenda:editar', 'turno:crear', 'turno:editar',
    'prestacion:ver', 'prestacion:editar',
    'especialidad:ver', 'especialidad:editar',
    'sede:ver',
    'hc:ver', 'evolucion:ver',
    'cobertura:ver', 'cobertura:editar',
    'comunicacion:ver', 'comunicacion:crear',
    'reporte:ver',
    'auditoria:ver',
  ],

  MEDICO: [
    'paciente:ver', 'paciente:editar',
    'agenda:ver_propia',
    'turno:editar_propia',
    'hc:ver', 'hc:editar_propia',
    'evolucion:ver', 'evolucion:crear', 'evolucion:editar_propia',
    'antecedente:ver', 'antecedente:crear', 'antecedente:editar',
    'alergia:ver', 'alergia:crear', 'alergia:editar',
    'medicacion:ver', 'medicacion:crear', 'medicacion:editar',
    'diagnostico:ver', 'diagnostico:crear',
    'indicacion:ver', 'indicacion:crear', 'indicacion:editar_propia',
    'estudio:ver', 'estudio:crear',
    'documento:ver', 'documento:crear',
    'consentimiento:ver', 'consentimiento:crear',
    'prestacion:ver',
    'comunicacion:crear',
  ],

  RECEPCION: [
    'paciente:ver', 'paciente:crear', 'paciente:editar',
    'profesional:ver',
    'agenda:ver', 'agenda:editar', 'turno:crear', 'turno:editar',
    'prestacion:ver',
    'especialidad:ver',
    'sede:ver',
    'cobertura:ver',
    'comunicacion:ver', 'comunicacion:crear',
    'comprobante:ver', 'pago:crear',
  ],

  FACTURACION: [
    'paciente:ver',
    'cobertura:ver', 'cobertura:editar',
    'comprobante:ver', 'comprobante:crear', 'comprobante:editar',
    'pago:ver', 'pago:crear',
    'deuda:ver',
    'caja:ver', 'caja:editar',
    'liquidacion:ver', 'liquidacion:crear',
    'autorizacion:ver', 'autorizacion:crear',
    'reporte:ver',
  ],

  AUDITOR: [
    'auditoria:ver',
    'paciente:ver',
    'hc:ver',
    'evolucion:ver',
    'reporte:ver',
    'comprobante:ver',
    'pago:ver',
  ],

  PACIENTE: [
    'portal:ver_propia',
  ],
}

export function hasPermiso(rol: RolUsuario, permiso: Permiso): boolean {
  const permisos = POLICIES[rol]
  if (!permisos) return false
  if (permisos.includes('*')) return true
  return permisos.includes(permiso)
}

/**
 * Variante con fallback al permiso de "propia" cuando se pide la accion sin
 * scope. Ej: hasPermisoFlexible('MEDICO', 'hc:editar') => true (porque tiene
 * 'hc:editar_propia', el caller debe luego validar el scope).
 */
export function hasPermisoFlexible(rol: RolUsuario, permiso: Permiso): boolean {
  if (hasPermiso(rol, permiso)) return true
  return hasPermiso(rol, `${permiso}_propia`)
}
