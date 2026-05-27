/**
 * Helper para crear notificaciones in-app del panel admin.
 *
 * Best-effort: si falla la insercion no rompe el flujo de negocio.
 */

import { prisma } from './prisma'
import type { TipoNotificacion, RolUsuario } from '@prisma/client'

export interface CrearNotificacionInput {
  tipo: TipoNotificacion
  titulo: string
  cuerpo?: string
  usuario_id: string   // Notificacion requiere usuario_id (sin globales en Salud)
  link?: string | null
  metadata?: Record<string, unknown> | null
}

export async function crearNotificacion(input: CrearNotificacionInput): Promise<void> {
  try {
    await prisma.notificacion.create({
      data: {
        tipo: input.tipo,
        titulo: input.titulo,
        cuerpo: input.cuerpo ?? null,
        usuario_id: input.usuario_id,
        link: input.link ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notificaciones] No se pudo crear:', err)
  }
}

/**
 * Notifica a TODOS los usuarios activos con uno de los roles indicados.
 * Útil para alertas administrativas (stock crítico, comprobante pendiente).
 */
export async function notificarRoles(
  input: Omit<CrearNotificacionInput, 'usuario_id'> & { roles: RolUsuario[] },
): Promise<void> {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: { rol: { in: input.roles }, activo: true },
      select: { id: true },
    })
    if (usuarios.length === 0) return
    await prisma.notificacion.createMany({
      data: usuarios.map((u) => ({
        tipo: input.tipo,
        titulo: input.titulo,
        cuerpo: input.cuerpo ?? null,
        usuario_id: u.id,
        link: input.link ?? null,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      })),
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[notificaciones] notificarRoles falló:', err)
  }
}
