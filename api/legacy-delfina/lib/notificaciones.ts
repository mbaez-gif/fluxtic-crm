/**
 * Helper para crear notificaciones del panel admin.
 *
 * Las notificaciones aparecen en la campanita del topbar. Pueden ser:
 *   - Globales (usuario_id = null): todos los admins las ven.
 *   - Dirigidas (usuario_id != null): solo ese admin las ve.
 *
 * Best-effort: si falla la insercion no rompe el flujo de negocio.
 */

import { prisma } from './prisma'
import type { TipoNotificacion } from '@prisma/client'

export interface CrearNotificacionInput {
  tipo: TipoNotificacion
  titulo: string
  mensaje: string
  referencia_id?: string | null
  url_destino?: string | null
  usuario_id?: string | null
}

export async function crearNotificacion(input: CrearNotificacionInput): Promise<void> {
  try {
    await prisma.notificacion.create({
      data: {
        tipo: input.tipo,
        titulo: input.titulo,
        mensaje: input.mensaje,
        referencia_id: input.referencia_id ?? null,
        url_destino: input.url_destino ?? null,
        usuario_id: input.usuario_id ?? null,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[notificaciones] No se pudo crear: ${msg}`)
  }
}
