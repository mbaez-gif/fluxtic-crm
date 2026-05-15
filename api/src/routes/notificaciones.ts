/**
 * Routes: /notificaciones
 *
 * Endpoints para el panel admin (campanita + dropdown).
 *
 * GET    /notificaciones              -> lista las ultimas N (default 50)
 * GET    /notificaciones/no-leidas    -> { count: number }
 * PATCH  /notificaciones/:id/leida    -> marca una como leida
 * POST   /notificaciones/marcar-todas -> marca todas como leidas
 * DELETE /notificaciones/:id          -> elimina una
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { handleError, errors } from '../utils/http-errors'

export async function notificacionesRoutes(fastify: FastifyInstance) {
  // GET /notificaciones?limit=50&solo_no_leidas=false
  fastify.get('/', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>
      const limit = Math.min(parseInt(q.limit ?? '50', 10), 200)
      const soloNoLeidas = q.solo_no_leidas === 'true'

      const notifs = await prisma.notificacion.findMany({
        where: soloNoLeidas ? { leida: false } : {},
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return reply.send({ data: notifs, total: notifs.length })
    } catch (err) {
      handleError(err, reply)
    }
  })

  // GET /notificaciones/no-leidas -> { count }
  fastify.get('/no-leidas', async (_request, reply) => {
    try {
      const count = await prisma.notificacion.count({ where: { leida: false } })
      return reply.send({ count })
    } catch (err) {
      handleError(err, reply)
    }
  })

  // PATCH /notificaciones/:id/leida
  fastify.patch('/:id/leida', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const updated = await prisma.notificacion.update({
        where: { id },
        data: { leida: true, leida_at: new Date() },
      })
      return reply.send(updated)
    } catch (err) {
      if (err instanceof Error && err.message.includes('Record to update not found')) {
        return handleError(errors.notFound('Notificación'), reply)
      }
      handleError(err, reply)
    }
  })

  // POST /notificaciones/marcar-todas
  fastify.post('/marcar-todas', async (_request, reply) => {
    try {
      const result = await prisma.notificacion.updateMany({
        where: { leida: false },
        data: { leida: true, leida_at: new Date() },
      })
      return reply.send({ marcadas: result.count })
    } catch (err) {
      handleError(err, reply)
    }
  })

  // DELETE /notificaciones/:id
  fastify.delete('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      await prisma.notificacion.delete({ where: { id } })
      return reply.send({ ok: true })
    } catch (err) {
      handleError(err, reply)
    }
  })
}
