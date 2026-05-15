/**
 * Helper de auditoria clinica.
 * Toda visualizacion/modificacion sobre entidades clinicas debe loggearse
 * via writeAudit(). El log es persistente y append-only desde el codigo.
 */

import { FastifyRequest } from 'fastify'
import { prisma } from './prisma'
import type { AccionAuditoria } from '@prisma/client'

export interface AuditInput {
  usuario_id?: string | null
  accion: AccionAuditoria
  entidad: string
  entidad_id?: string | null
  descripcion?: string
  diff?: unknown
  contexto?: Record<string, unknown>
  ip?: string
  user_agent?: string
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        usuario_id: input.usuario_id ?? null,
        accion: input.accion,
        entidad: input.entidad,
        entidad_id: input.entidad_id ?? null,
        descripcion: input.descripcion,
        diff: input.diff != null ? JSON.stringify(input.diff) : null,
        contexto: input.contexto != null ? JSON.stringify(input.contexto) : null,
        ip: input.ip,
        user_agent: input.user_agent,
      },
    })
  } catch (err) {
    // Auditoria no debe romper la operacion principal — pero el evento debe
    // quedar visible en logs del proceso para investigacion posterior.
    // eslint-disable-next-line no-console
    console.error('[audit] no se pudo escribir AuditLog', err, input)
  }
}

/**
 * Extrae IP y user-agent del request Fastify para pasar a writeAudit().
 */
export function auditMetaFromRequest(req: FastifyRequest) {
  return {
    ip:
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.ip,
    user_agent: req.headers['user-agent'],
  }
}
