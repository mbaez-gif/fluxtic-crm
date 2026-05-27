/**
 * Endpoints de pagos Mercado Pago (copago / seña previa).
 *
 * - GET    /pagos-mp                          listar con filtros
 * - GET    /pagos-mp/:id                      detalle
 * - POST   /pagos-mp/turno/:id/generar         genera preference + link para un turno
 * - POST   /pagos-mp/:id/reenviar-link         regenera preference
 * - POST   /pagos-mp/vencer                    cron expiración (requiere x-internal-token)
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'
import { crearPreference } from '../services/mercadopago.service'
import { vencerReservasExpiradas } from '../services/expiracion.service'
import { calcularSenaPrevia } from '../services/copago.service'
import { generateExternalReference } from '../utils/external-reference'

export async function pagosMpRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    request.requirePermiso('pago:ver', { flexible: true })
    const q = (request.query as any) ?? {}
    const where: any = {}
    if (q.status) where.status = q.status
    if (q.turno_id) where.turno_id = q.turno_id
    const take = Math.min(parseInt(q.limit ?? '50', 10), 200)
    return prisma.pagoMercadoPago.findMany({
      where,
      include: {
        turno: {
          include: {
            paciente: { select: { id: true, nombre: true, apellido: true, dni: true } },
            prestacion: { select: { nombre: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take,
    })
  })

  app.get('/:id', async (request, reply) => {
    request.requirePermiso('pago:ver', { flexible: true })
    const { id } = parseOrFail(idParamSchema, request.params)
    const pago = await prisma.pagoMercadoPago.findUnique({
      where: { id },
      include: { turno: true },
    })
    if (!pago) return notFound(reply, 'Pago')
    return pago
  })

  app.post('/turno/:id/generar', async (request, reply) => {
    const user = request.requirePermiso('pago:crear', { flexible: true })
    const { id } = parseOrFail(idParamSchema, request.params)
    const turno = await prisma.turno.findUnique({
      where: { id },
      include: {
        paciente: { include: { coberturas: { where: { principal: true, activa: true }, take: 1 } } },
        prestacion: true,
      },
    })
    if (!turno) return notFound(reply, 'Turno')
    if (!turno.prestacion) {
      return reply.code(400).send({ error: 'Bad request', message: 'Turno sin prestación asociada' })
    }

    // Verificar que no haya pagos activos
    const activo = await prisma.pagoMercadoPago.findFirst({
      where: { turno_id: id, status: { in: ['CREADO', 'PENDIENTE', 'APROBADO'] } },
    })
    if (activo) {
      return reply.code(409).send({ error: 'Conflict', message: 'Turno ya tiene un pago activo', pago_id: activo.id })
    }

    const calculo = await calcularSenaPrevia(
      turno.prestacion,
      turno.paciente.coberturas[0]?.id,
    )
    if (!calculo.requiere) {
      return reply.code(400).send({ error: 'Bad request', message: calculo.motivo ?? 'No se requiere seña previa' })
    }

    const externalRef = generateExternalReference(id)
    const preference = await crearPreference({
      external_reference: externalRef,
      amount: calculo.monto,
      description: `${turno.prestacion.nombre} — ${turno.paciente.nombre} ${turno.paciente.apellido}`,
      payer: {
        name: turno.paciente.nombre,
        surname: turno.paciente.apellido,
        email: turno.paciente.email ?? undefined,
        phone: turno.paciente.telefono ?? undefined,
      },
    })

    const expiracionMin = parseInt(process.env.RESERVA_EXPIRACION_MINUTOS ?? '30', 10)

    const pago = await prisma.$transaction(async (tx) => {
      const p = await tx.pagoMercadoPago.create({
        data: {
          turno_id: id,
          external_reference: externalRef,
          preference_id: preference.preference_id,
          init_point: preference.init_point,
          amount: calculo.monto as any,
          currency: 'ARS',
          status: 'CREADO',
        },
      })
      await tx.turno.update({
        where: { id },
        data: {
          estado: 'PENDIENTE_PAGO_MP',
          requiere_copago: true,
          monto_copago: calculo.monto as any,
          metodo_copago: 'MERCADOPAGO',
          mp_preference_id: preference.preference_id,
          mp_init_point: preference.init_point,
          mp_external_reference: externalRef,
          reserva_expira_en: new Date(Date.now() + expiracionMin * 60 * 1000),
        },
      })
      return p
    })

    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'PagoMercadoPago',
      entidad_id: pago.id,
      contexto: { turno_id: id, paciente_id: turno.paciente_id, monto: calculo.monto },
      ...auditMetaFromRequest(request),
    })

    return reply.code(201).send({
      ok: true,
      pago_id: pago.id,
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      external_reference: externalRef,
      amount: calculo.monto,
      expira_en: new Date(Date.now() + expiracionMin * 60 * 1000),
    })
  })

  app.post('/:id/reenviar-link', async (request, reply) => {
    const user = request.requirePermiso('pago:crear', { flexible: true })
    const { id } = parseOrFail(idParamSchema, request.params)
    const pago = await prisma.pagoMercadoPago.findUnique({
      where: { id },
      include: { turno: { include: { paciente: true, prestacion: true } } },
    })
    if (!pago) return notFound(reply, 'Pago')
    if (!pago.turno.prestacion) {
      return reply.code(400).send({ error: 'Bad request', message: 'Turno sin prestación' })
    }
    if (['APROBADO', 'REEMBOLSADO'].includes(pago.status)) {
      return reply.code(400).send({ error: 'Bad request', message: `Pago en estado ${pago.status}` })
    }

    const externalRef = generateExternalReference(pago.turno_id)
    const preference = await crearPreference({
      external_reference: externalRef,
      amount: Number(pago.amount),
      description: `${pago.turno.prestacion.nombre} — ${pago.turno.paciente.nombre} ${pago.turno.paciente.apellido}`,
      payer: {
        name: pago.turno.paciente.nombre,
        surname: pago.turno.paciente.apellido,
        email: pago.turno.paciente.email ?? undefined,
      },
    })

    const nuevo = await prisma.pagoMercadoPago.create({
      data: {
        turno_id: pago.turno_id,
        external_reference: externalRef,
        preference_id: preference.preference_id,
        init_point: preference.init_point,
        amount: pago.amount,
        currency: pago.currency,
        status: 'CREADO',
      },
    })

    // Marcar el viejo como VENCIDO si seguía CREADO/PENDIENTE
    if (['CREADO', 'PENDIENTE'].includes(pago.status)) {
      await prisma.pagoMercadoPago.update({
        where: { id: pago.id },
        data: { status: 'VENCIDO', status_detail: 'Reemplazado por nuevo link' },
      })
    }

    await prisma.turno.update({
      where: { id: pago.turno_id },
      data: {
        mp_preference_id: preference.preference_id,
        mp_init_point: preference.init_point,
        mp_external_reference: externalRef,
        reserva_expira_en: new Date(Date.now() + 30 * 60 * 1000),
      },
    })

    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'PagoMercadoPago',
      entidad_id: nuevo.id,
      descripcion: 'Reenvio de link de pago',
      contexto: { turno_id: pago.turno_id, pago_anterior_id: pago.id },
      ...auditMetaFromRequest(request),
    })

    return reply.code(201).send({
      ok: true,
      pago_id: nuevo.id,
      init_point: preference.init_point,
      external_reference: externalRef,
    })
  })

  /**
   * Cron de vencimiento de reservas — disparado por n8n cada 1 minuto.
   * Requiere x-internal-token.
   */
  app.post('/vencer', async (request, reply) => {
    const token = request.headers['x-internal-token']
    if (!token || token !== process.env.INTERNAL_API_TOKEN) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'x-internal-token requerido' })
    }
    const result = await vencerReservasExpiradas()
    if (result.vencidos > 0) {
      await prisma.automatizacionLog.create({
        data: {
          evento: 'cron_vencer_reservas',
          payload: JSON.stringify(result),
          estado: 'OK',
        },
      }).catch(() => {})
    }
    return result
  })

  /**
   * Estado público de un pago por external_reference (lo consulta el frontend
   * después de volver de Mercado Pago para confirmar el resultado).
   */
  app.get('/estado/:external_reference', async (request, reply) => {
    const params = parseOrFail(
      z.object({ external_reference: z.string().min(1) }),
      request.params,
    )
    const pago = await prisma.pagoMercadoPago.findUnique({
      where: { external_reference: params.external_reference },
      select: {
        id: true,
        status: true,
        status_detail: true,
        amount: true,
        turno: { select: { id: true, estado: true, fecha_hora: true } },
      },
    })
    if (!pago) return notFound(reply, 'Pago')
    return pago
  })
}
