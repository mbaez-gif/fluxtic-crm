/**
 * Reservas públicas: usado por
 *  - Portal del paciente / wizard público (sin auth, con Turnstile opcional)
 *  - n8n / IA (con x-internal-token)
 *
 * Crea/reusa Paciente por DNI, valida slot, dispara evento turno-creado a n8n.
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { parseOrFail } from '../lib/zod-helpers'
import { crearReserva } from '../services/reservas.service'
import { dispararEventoN8n } from '../lib/n8n'
import { validarTurnstile } from '../lib/turnstile'

const reservaSchema = z.object({
  prestacion_id: z.string().min(1),
  profesional_id: z.string().min(1),
  sede_id: z.string().min(1),
  consultorio_id: z.string().nullable().optional(),
  fecha_hora: z.string().datetime(),
  modalidad: z.enum(['PRESENCIAL', 'VIRTUAL']).optional(),
  motivo_consulta: z.string().nullable().optional(),
  metodo_copago_preferido: z.enum(['MERCADOPAGO', 'TRANSFERENCIA', 'SIN_COPAGO']).optional(),
  paciente: z.object({
    dni: z.string().min(6),
    nombre: z.string().min(1),
    apellido: z.string().min(1),
    telefono: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    fecha_nacimiento: z.string().datetime().nullable().optional(),
    cobertura_id: z.string().nullable().optional(),
    plan_id: z.string().nullable().optional(),
    numero_afiliado: z.string().nullable().optional(),
  }),
  turnstile_token: z.string().nullable().optional(),
})

export async function reservasPublicasRoutes(fastify: FastifyInstance) {
  // POST /reservas-publicas
  fastify.post('/', async (request, reply) => {
    const data = parseOrFail(reservaSchema, request.body)

    // Determinar origen: si tiene x-internal-token confiamos en n8n, si no es público
    const internalToken = request.headers['x-internal-token']
    const esInterno = internalToken && internalToken === process.env.INTERNAL_API_TOKEN
    const origen = esInterno ? 'N8N' : 'LINK_PUBLICO'

    // Validar Turnstile solo si NO viene con token interno (n8n)
    if (!esInterno && process.env.TURNSTILE_SECRET_KEY) {
      try {
        await validarTurnstile(data.turnstile_token ?? undefined, request.ip)
      } catch (err: any) {
        return reply.code(err.statusCode ?? 403).send({ error: 'Forbidden', message: err.message ?? 'Turnstile inválido' })
      }
    }

    try {
      const result = await crearReserva({
        prestacion_id: data.prestacion_id,
        profesional_id: data.profesional_id,
        sede_id: data.sede_id,
        consultorio_id: data.consultorio_id,
        fecha_hora: new Date(data.fecha_hora),
        modalidad: data.modalidad,
        motivo_consulta: data.motivo_consulta,
        metodo_copago_preferido: data.metodo_copago_preferido,
        origen,
        paciente: {
          ...data.paciente,
          fecha_nacimiento: data.paciente.fecha_nacimiento ? new Date(data.paciente.fecha_nacimiento) : null,
        },
      })

      // Disparar evento a n8n para workflow de confirmación
      dispararEventoN8n('turno-creado', {
        turno_id: result.turno_id,
        paciente_id: result.paciente_id,
        paciente_es_nuevo: result.paciente_es_nuevo,
        requiere_pago: result.requiere_pago,
        metodo_pago: result.metodo_pago,
        monto_copago: result.monto_copago,
        init_point: result.init_point,
        external_reference: result.external_reference,
        reserva_expira_en: result.reserva_expira_en?.toISOString() ?? null,
        origen,
      }).catch(() => {})

      return reply.code(201).send(result)
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: 'Error', message: err.message })
    }
  })

  // GET /reservas-publicas/estado/:external_reference
  // Polling después de volver de Mercado Pago
  fastify.get('/estado/:external_reference', async (request, reply) => {
    const params = parseOrFail(z.object({ external_reference: z.string() }), request.params)
    const pago = await prisma.pagoMercadoPago.findUnique({
      where: { external_reference: params.external_reference },
      include: {
        turno: {
          select: {
            id: true,
            estado: true,
            fecha_hora: true,
            paciente: { select: { nombre: true, apellido: true, dni: true } },
            prestacion: { select: { nombre: true } },
            profesional: { include: { usuario: { select: { nombre: true, apellido: true } } } },
            sede: { select: { nombre: true } },
          },
        },
      },
    })
    if (!pago) return reply.code(404).send({ error: 'Not found' })
    return {
      pago_status: pago.status,
      pago_status_detail: pago.status_detail,
      turno: pago.turno,
    }
  })

  // GET /reservas-publicas/config
  // Devuelve config relevante para el wizard público (qué métodos acepta, vencimientos, etc.)
  fastify.get('/config', async () => {
    const [clinica, fact, agenda] = await Promise.all([
      prisma.configuracionClinica.findUnique({ where: { id: 'singleton' } }),
      prisma.configuracionFacturacion.findUnique({ where: { id: 'singleton' } }),
      prisma.configuracionAgenda.findUnique({ where: { id: 'singleton' } }),
    ])
    return {
      clinica: {
        nombre: clinica?.nombre,
        logo_url: clinica?.logo_url,
        color_principal: clinica?.color_principal,
      },
      facturacion: {
        requiere_sena: fact?.requiere_sena ?? false,
        acepta_mercadopago: fact?.acepta_mercadopago ?? false,
        acepta_transferencia: fact?.acepta_transferencia ?? true,
      },
      agenda: {
        cancelacion_min_horas: agenda?.cancelacion_min_horas ?? 24,
        anticipacion_min_horas: agenda?.anticipacion_min_horas ?? 2,
      },
      reserva_expiracion_minutos: parseInt(process.env.RESERVA_EXPIRACION_MINUTOS ?? '30', 10),
    }
  })
}
