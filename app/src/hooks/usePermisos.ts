'use client'

import { useSession } from 'next-auth/react'
import { hasPermiso, hasPermisoFlexible, type Permiso, type RolUsuario } from '@/lib/permissions'

export interface PermisosApi {
  rol: RolUsuario | undefined
  has: (permiso: Permiso) => boolean
  hasAny: (...permisos: Permiso[]) => boolean
  hasFlexible: (permiso: Permiso) => boolean
}

export function usePermisos(): PermisosApi {
  const { data: session } = useSession()
  const rol = ((session?.user as any)?.rol ?? undefined) as RolUsuario | undefined

  return {
    rol,
    has: (permiso) => hasPermiso(rol, permiso),
    hasAny: (...permisos) => permisos.some((p) => hasPermiso(rol, p)),
    hasFlexible: (permiso) => hasPermisoFlexible(rol, permiso),
  }
}
