'use client'

import { useSession } from 'next-auth/react'
import type { Permisos } from '@/types/usuarios'
import { PERMISOS_FULL } from '@/types/usuarios'

export function usePermisos(): Permisos {
  const { data: session } = useSession()
  const rol = (session?.user as any)?.rol as string | undefined

  // OWNER siempre tiene acceso total
  if (rol === 'OWNER') return PERMISOS_FULL

  const stored = (session?.user as any)?.permisos as Partial<Permisos> | undefined
  if (!stored) return PERMISOS_FULL  // mientras carga, no bloquear

  return {
    puede_ver_caja:                stored.puede_ver_caja                ?? false,
    puede_cobrar:                  stored.puede_cobrar                  ?? false,
    puede_anular_ventas:           stored.puede_anular_ventas           ?? false,
    puede_reimprimir_comprobantes: stored.puede_reimprimir_comprobantes ?? false,
    puede_ver_ventas_dia:          stored.puede_ver_ventas_dia          ?? false,
    puede_ver_reportes:            stored.puede_ver_reportes            ?? false,
    puede_gestionar_turnos:        stored.puede_gestionar_turnos        ?? true,
    puede_gestionar_clientes:      stored.puede_gestionar_clientes      ?? false,
    puede_gestionar_servicios:     stored.puede_gestionar_servicios     ?? false,
    puede_gestionar_productos:     stored.puede_gestionar_productos     ?? false,
    puede_gestionar_configuracion: stored.puede_gestionar_configuracion ?? false,
    puede_gestionar_usuarios:      stored.puede_gestionar_usuarios      ?? false,
    puede_gestionar_integraciones: stored.puede_gestionar_integraciones ?? false,
  }
}
