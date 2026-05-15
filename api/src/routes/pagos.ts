/**
 * Routes: /pagos
 *
 * Gestión de pagos de seña desde el admin.
 * Requiere auth (asumimos que el preHandler está en index.ts o existe authPlugin).
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { handleError, errors } from '../utils/http-errors'
import { reconciliarPago } from '../services/pagos.service'
import { crearPreference } from '../services/mercadopago.service'
import { generateExternalReference } from '../utils/external-reference'

export async function pagosRoutes(fastify: FastifyInstance) {
  /**
   * GET /pagos
   *
   * Listado con filtros.
   * Query params:
   *   - status: filtro por estado (CREADO, APROBADO, etc.)
   *   - turno_id: filtro por turno
   *   - desde: fecha desde (ISO 8601)
   *   - hasta: fecha hasta
   *   - limit: default 50, max 200
   *   - offset: paginación
   */
  fastify.get('/', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>

      const where: any = {}
      if (q.status) where.status = q.status
      if (q.turno_id) where.turno_id = q.turno_id
      if (q.desde || q.hasta) {
        where.createdAt = {}
        if (q.desde) where.createdAt.gte = new Date(q.desde)
        if (q.hasta) where.createdAt.lte = new Date(q.hasta)
      }

      const limit = Math.min(parseInt(q.limit || '50', 10), 200)
      const offset = parseInt(q.offset || '0', 10)

      const [pagos, total] = await Promise.all([
        prisma.pagoSena.findMany({
          where,
          include: {
            turno: {
              select: {
                id: true,
                fecha: true,
                estado: true,
                cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
                servicio: { select: { nombre: true } },
                profesional: { select: { nombre: true, apellido: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.pagoSena.count({ where }),
      ])

      return reply.send({
        total,
        limit,
        offset,
        pagos: pagos.map(p => ({
          id: p.id,
          status: p.status,
          status_detail: p.status_detail,
          amount: Number(p.amount),
          payment_id: p.payment_id,
          external_reference: p.external_reference,
          createdAt: p.createdAt,
          approved_at: p.approved_at,
          turno: p.turno,
        })),
      })
    } catch (err) {
      handleError(err, reply)
    }
  })

  /**
   * GET /pagos/:id
   *
   * Detalle de un pago, incluyendo payload del webhook y respuesta de MP.
   */
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const pago = await prisma.pagoSena.findUnique({
        where: { id },
        include: {
          turno: {
            include: {
              cliente: true,
              servicio: true,
              profesional: { select: { id: true, nombre: true, apellido: true } },
            },
          },
        },
      })

      if (!pago) throw errors.notFound('Pago')

      return reply.send(pago)
    } catch (err) {
      handleError(err, reply)
    }
  })

  /**
   * POST /pagos/:id/reenviar-link
   *
   * Genera una nueva preference MP para el mismo turno.
   * Útil cuando la clienta perdió el link original o el pago expiró.
   *
   * Crea un nuevo PagoSena (no reusa el viejo) para mantener auditoría.
   */
  fastify.post('/:id/reenviar-link', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const pagoOriginal = await prisma.pagoSena.findUnique({
        where: { id },
        include: { turno: { include: { cliente: true, servicio: true } } },
      })

      if (!pagoOriginal) throw errors.notFound('Pago')

      const turno = pagoOriginal.turno

      // Solo permitir si el turno está vivo (no completado/cancelado)
      const estadosVivos = ['PENDIENTE', 'PENDIENTE_PAGO_MP', 'PENDIENTE_VALIDACION_MANUAL', 'CONFIRMADO', 'VENCIDO']
      if (!estadosVivos.includes(turno.estado)) {
        throw errors.badRequest(`No se puede reenviar link: turno en estado ${turno.estado}`)
      }

      const externalRef = generateExternalReference(turno.id)

      const preference = await crearPreference({
        external_reference: externalRef,
        amount: Number(pagoOriginal.amount),
        description: `Seña - ${turno.servicio.nombre}`,
        payer: {
          name: turno.cliente.nombre,
          surname: turno.cliente.apellido || undefined,
          email: turno.cliente.email || undefined,
          phone: turno.cliente.telefono || undefined,
        },
      })

      const nuevoPago = await prisma.$transaction(async tx => {
        const np = await tx.pagoSena.create({
          data: {
            turno_id: turno.id,
            external_reference: externalRef,
            preference_id: preference.preference_id,
            init_point: preference.init_point,
            amount: pagoOriginal.amount,
            currency: pagoOriginal.currency,
            status: 'CREADO',
          },
        })

        // Actualizar Turno con nueva referencia (denormalizado)
        // Si el turno estaba VENCIDO, lo revivimos a PENDIENTE_PAGO_MP con nuevo vencimiento
        const expiracionMin = parseInt(process.env.RESERVA_EXPIRACION_MINUTOS || '15', 10)
        await tx.turno.update({
          where: { id: turno.id },
          data: {
            mp_preference_id: preference.preference_id,
            mp_init_point: preference.init_point,
            mp_external_reference: externalRef,
            ...(turno.estado === 'VENCIDO'
              ? {
                  estado: 'PENDIENTE_PAGO_MP',
                  reserva_expira_en: new Date(Date.now() + expiracionMin * 60 * 1000),
                }
              : {}),
          },
        })

        await tx.eventoN8n.create({
          data: {
            workflow_name: 'pago_link_reenviado',
            estado: 'EXITOSO',
            mensaje: `Nuevo link de pago generado para turno ${turno.id}`,
            referencia_id: turno.id,
            payload: {
              turno_id: turno.id,
              pago_anterior_id: pagoOriginal.id,
              pago_nuevo_id: np.id,
              external_reference: externalRef,
            },
          },
        })

        return np
      })

      return reply.send({
        pago_sena_id: nuevoPago.id,
        external_reference: externalRef,
        init_point: preference.init_point,
        amount: Number(nuevoPago.amount),
      })
    } catch (err) {
      handleError(err, reply)
    }
  })

  /**
   * POST /pagos/:id/conciliar
   *
   * Fuerza la consulta a MP de un pago para reconciliar estado.
   * Útil para n8n cron de seguridad (por si se perdió un webhook).
   *
   * Requiere X-Internal-Token o auth de admin.
   */
  fastify.post('/:id/conciliar', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const result = await reconciliarPago(id)
      return reply.send(result)
    } catch (err) {
      handleError(err, reply)
    }
  })
}
