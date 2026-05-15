/**
 * Espejo client-side de api/src/lib/policies.ts.
 * Mantener sincronizado manualmente al editar el archivo del backend.
 */

export type RolUsuario =
  | 'ADMIN_GENERAL'
  | 'RECEPCION'
  | 'FACTURACION'
  | 'MEDICO'
  | 'COORDINADOR_MEDICO'
  | 'PACIENTE'
  | 'AUDITOR'

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

  PACIENTE: ['portal:ver_propia'],
}

export function hasPermiso(rol: RolUsuario | undefined, permiso: Permiso): boolean {
  if (!rol) return false
  const permisos = POLICIES[rol]
  if (!permisos) return false
  if (permisos.includes('*')) return true
  return permisos.includes(permiso)
}

export function hasPermisoFlexible(rol: RolUsuario | undefined, permiso: Permiso): boolean {
  if (hasPermiso(rol, permiso)) return true
  return hasPermiso(rol, `${permiso}_propia`)
}
