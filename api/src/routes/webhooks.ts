import type { FastifyInstance } from 'fastify'
import { procesarWebhookMp } from '../services/pagos.service'
import { validarFirmaWebhook } from '../services/mercadopago.service'
import { dispararEventoN8n } from '../lib/n8n'

export async function webhooksRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  app.post('/n8n/turno-creado', async (request, reply) => {
    const body = request.body as any

    const evento = await prisma.eventoN8n.create({
      data: {
        workflow_name: body.workflow_name ?? 'turno-creado',
        workflow_id: body.workflow_id ?? null,
        estado: 'PENDIENTE',
        mensaje: body.mensaje ?? 'Evento recibido desde n8n',
        referencia_id: body.referencia_id ?? body.turno_id ?? null,
        usuario_id: body.usuario_id ?? null,
      },
    })

    return reply.code(201).send({
      ok: true,
      evento_id: evento.id,
    })
  })

  app.post('/whatsapp', async (request, reply) => {
    const body = request.body as any

    const consulta = await prisma.consulta.create({
      data: {
        canal: 'WHATSAPP',
        mensaje: JSON.stringify(body),
        estado: 'NUEVA',
      },
    })

    return reply.code(201).send({
      ok: true,
      consulta_id: consulta.id,
    })
  })

  app.post('/mercadopago', async (request, reply) => {
    const startTs = Date.now()

    try {
      const headers = request.headers
      const body = request.body as any
      const query = request.query as any

      const topic = body?.type || body?.topic || query?.topic || query?.type
      const dataId = body?.data?.id || body?.id || query?.id || query?.['data.id']

      if (!topic || !dataId) {
        await prisma.eventoN8n.create({
          data: {
            workflow_name: 'webhook_mp_payload_invalido',
            estado: 'ERROR',
            mensaje: 'Webhook MP sin topic o data.id',
            payload: { headers, body, query } as any,
          },
        }).catch(() => {})

        return reply.code(200).send({ ok: true, ignored: 'payload sin topic o data.id' })
      }

      const xSignature = headers['x-signature'] as string | undefined
      const xRequestId = headers['x-request-id'] as string | undefined

      const firmaCheck = validarFirmaWebhook({
        xSignature,
        xRequestId,
        dataId: String(dataId),
      })

      if (!firmaCheck.valida) {
        await prisma.eventoN8n.create({
          data: {
            workflow_name: 'webhook_mp_firma_invalida',
            estado: 'ERROR',
            mensaje: `Firma inválida: ${firmaCheck.razon}`,
            payload: { headers, body, topic, dataId } as any,
          },
        }).catch(() => {})

        return reply.code(401).send({ error: 'Firma inválida' })
      }

      const result = await procesarWebhookMp({
        topic: String(topic),
        resourceId: String(dataId),
      })

      const duracionMs = Date.now() - startTs

      await prisma.eventoN8n.create({
        data: {
          workflow_name: 'webhook_mp_procesado',
          estado: result.procesado ? 'EXITOSO' : 'PENDIENTE',
          mensaje: result.mensaje,
          referencia_id: result.turnoId,
          payload: {
            topic,
            dataId,
            resultado: result.resultado,
            pagoSenaId: result.pagoSenaId,
            duracion_ms: duracionMs,
          } as any,
        },
      }).catch(() => {})

      if (result.resultado === 'aprobado' && result.turnoId) {
        dispararEventoN8n('pago-aprobado', {
          turno_id: result.turnoId,
          pago_sena_id: result.pagoSenaId,
        }).catch(() => {})
      } else if (result.resultado === 'rechazado' && result.turnoId) {
        dispararEventoN8n('pago-rechazado', {
          turno_id: result.turnoId,
          pago_sena_id: result.pagoSenaId,
        }).catch(() => {})
      } else if (result.resultado === 'validacion_manual' && result.turnoId) {
        dispararEventoN8n('pago-validacion-manual', {
          turno_id: result.turnoId,
          pago_sena_id: result.pagoSenaId,
          mensaje: result.mensaje,
        }).catch(() => {})
      }

      return reply.code(200).send({ ok: true, ...result })
    } catch (err: any) {
      console.error('[webhook-mp] Error procesando webhook:', err)

      await prisma.eventoN8n.create({
        data: {
          workflow_name: 'webhook_mp_error',
          estado: 'ERROR',
          mensaje: err?.message || 'Error desconocido procesando webhook MP',
          payload: { body: request.body, query: request.query } as any,
          error: err?.stack || String(err),
        },
      }).catch(() => {})

      if (err?.statusCode === 404) {
        return reply.code(200).send({ ok: false, error: 'Recurso no encontrado en MP' })
      }

      return reply.code(500).send({ ok: false, error: err?.message })
    }
  })

}
