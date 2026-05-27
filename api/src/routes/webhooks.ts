/**
 * Webhooks externos:
 * - POST /webhooks/mercadopago  (recibe IPN de MP, valida firma)
 * - POST /webhooks/n8n/turno-confirmacion-enviada (n8n callback, requiere x-internal-token)
 * - POST /webhooks/n8n/turno-recordatorio-enviado
 * - POST /webhooks/n8n/turno-postconsulta-enviada
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { procesarWebhookMp } from '../services/pagos.service'
import { validarFirmaWebhook } from '../services/mercadopago.service'
import { dispararEventoN8n } from '../lib/n8n'
import { parseOrFail } from '../lib/zod-helpers'

const turnoIdBody = z.object({ turno_id: z.string().min(1), wamid: z.string().optional() })

export async function webhooksRoutes(app: FastifyInstance) {
  // ── Mercado Pago ────────────────────────────────────────────
  app.post('/mercadopago', async (request, reply) => {
    const startTs = Date.now()
    try {
      const headers = request.headers
      const body = request.body as any
      const query = request.query as any

      const topic = body?.type || body?.topic || query?.topic || query?.type
      const dataId = body?.data?.id || body?.id || query?.id || query?.['data.id']

      if (!topic || !dataId) {
        await prisma.automatizacionLog.create({
          data: {
            evento: 'webhook_mp_payload_invalido',
            payload: JSON.stringify({ headers, body, query }),
            estado: 'ERROR',
            error_mensaje: 'Webhook MP sin topic o data.id',
          },
        }).catch(() => {})
        return reply.code(200).send({ ok: true, ignored: 'payload sin topic o data.id' })
      }

      const xSignature = headers['x-signature'] as string | undefined
      const xRequestId = headers['x-request-id'] as string | undefined

      const firmaCheck = validarFirmaWebhook({ xSignature, xRequestId, dataId: String(dataId) })
      if (!firmaCheck.valida) {
        await prisma.automatizacionLog.create({
          data: {
            evento: 'webhook_mp_firma_invalida',
            payload: JSON.stringify({ headers, body, topic, dataId }),
            estado: 'ERROR',
            error_mensaje: `Firma inválida: ${firmaCheck.razon}`,
          },
        }).catch(() => {})
        return reply.code(401).send({ error: 'Firma inválida' })
      }

      const result = await procesarWebhookMp({ topic: String(topic), resourceId: String(dataId) })
      const duracionMs = Date.now() - startTs

      await prisma.automatizacionLog.create({
        data: {
          evento: 'webhook_mp_procesado',
          payload: JSON.stringify({ topic, dataId, resultado: result.resultado, pagoMpId: result.pagoMpId }),
          estado: result.procesado ? 'OK' : 'SKIPPED',
          duracion_ms: duracionMs,
        },
      }).catch(() => {})

      // Disparar eventos a n8n según resultado
      if (result.resultado === 'aprobado' && result.turnoId) {
        dispararEventoN8n('pago-aprobado', { turno_id: result.turnoId, pago_mp_id: result.pagoMpId }).catch(() => {})
      } else if (result.resultado === 'rechazado' && result.turnoId) {
        dispararEventoN8n('pago-rechazado', { turno_id: result.turnoId, pago_mp_id: result.pagoMpId }).catch(() => {})
      } else if (result.resultado === 'validacion_manual' && result.turnoId) {
        dispararEventoN8n('pago-validacion-manual', {
          turno_id: result.turnoId,
          pago_mp_id: result.pagoMpId,
          mensaje: result.mensaje,
        }).catch(() => {})
      }

      return reply.code(200).send({ ok: true, ...result })
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[webhook-mp] Error procesando webhook:', err)
      await prisma.automatizacionLog.create({
        data: {
          evento: 'webhook_mp_error',
          payload: JSON.stringify({ message: err?.message }),
          estado: 'ERROR',
          error_mensaje: err?.message ?? 'Error desconocido',
        },
      }).catch(() => {})
      return reply.code(500).send({ error: 'Internal', message: err?.message })
    }
  })

  // ── Callbacks de n8n (marcado de envíos) ────────────────────
  // Requieren x-internal-token (lo valida el preHandler global en /webhooks/n8n/*)
  app.post('/n8n/turno-confirmacion-enviada', async (request) => {
    const { turno_id, wamid } = parseOrFail(turnoIdBody, request.body)
    await prisma.$transaction([
      prisma.comunicacionPaciente.updateMany({
        where: { turno_id, tipo: 'CONFIRMACION_TURNO', estado: 'PENDIENTE' },
        data: { estado: 'ENVIADA', enviada_at: new Date(), external_id: wamid ?? null },
      }),
      prisma.automatizacionLog.create({
        data: {
          evento: 'turno_confirmacion_enviada',
          payload: JSON.stringify({ turno_id, wamid }),
          estado: 'OK',
        },
      }),
    ])
    return { ok: true }
  })

  app.post('/n8n/turno-recordatorio-enviado', async (request) => {
    const body = parseOrFail(
      z.object({
        turno_id: z.string(),
        ventana: z.enum(['48h', '24h', '2h']),
        wamid: z.string().optional(),
      }),
      request.body,
    )
    const campoFlag =
      body.ventana === '48h' ? 'recordatorio_48h_enviado'
        : body.ventana === '24h' ? 'recordatorio_24h_enviado'
          : 'recordatorio_2h_enviado'
    await prisma.turno.update({
      where: { id: body.turno_id },
      data: { [campoFlag]: true } as any,
    })
    await prisma.automatizacionLog.create({
      data: {
        evento: `turno_recordatorio_${body.ventana}_enviado`,
        payload: JSON.stringify(body),
        estado: 'OK',
      },
    })
    return { ok: true }
  })

  app.post('/n8n/turno-postconsulta-enviada', async (request) => {
    const { turno_id, wamid } = parseOrFail(turnoIdBody, request.body)
    await prisma.comunicacionPaciente.updateMany({
      where: { turno_id, tipo: 'POSTCONSULTA', estado: 'PENDIENTE' },
      data: { estado: 'ENVIADA', enviada_at: new Date(), external_id: wamid ?? null },
    })
    return { ok: true }
  })
}
