/**
 * Servicio wrapper del SDK de Mercado Pago.
 *
 * Responsabilidades:
 * - Crear preference de pago
 * - Consultar estado de un payment
 * - Validar firma de webhook (HMAC-SHA256)
 *
 * NO toca DB. Solo se comunica con MP. La orquestación de DB la hace pagos.service.ts
 */

import crypto from 'crypto'
import {
  preferenceClient,
  paymentClient,
  MP_CONFIG,
  assertMpConfigured,
} from '../lib/mercadopago'
import { errors } from '../utils/http-errors'

export interface CrearPreferenceInput {
  external_reference: string
  amount: number
  currency?: string
  payer?: {
    name?: string
    surname?: string
    email?: string
    phone?: string
  }
  description: string
}

export interface CrearPreferenceOutput {
  preference_id: string
  init_point: string
  sandbox_init_point: string
}

/**
 * Crea una preference en MP.
 * Configura URLs de retorno y notification_url automáticamente.
 */
export async function crearPreference(input: CrearPreferenceInput): Promise<CrearPreferenceOutput> {
  assertMpConfigured()

  const body: any = {
    external_reference: input.external_reference,
    items: [
      {
        id: input.external_reference,
        title: input.description,
        quantity: 1,
        currency_id: input.currency || 'ARS',
        unit_price: input.amount,
      },
    ],
    back_urls: {
      success: `${MP_CONFIG.successUrl}?ref=${encodeURIComponent(input.external_reference)}`,
      pending: `${MP_CONFIG.pendingUrl}?ref=${encodeURIComponent(input.external_reference)}`,
      failure: `${MP_CONFIG.failureUrl}?ref=${encodeURIComponent(input.external_reference)}`,
    },
    auto_return: 'approved',
    notification_url: MP_CONFIG.notificationUrl,
    statement_descriptor: 'DELFINA PAZ',
    binary_mode: false, // permite estados pending (rapipago, etc.)
  }

  if (input.payer) {
    body.payer = {
      name: input.payer.name,
      surname: input.payer.surname,
      email: input.payer.email,
      phone: input.payer.phone ? { number: input.payer.phone } : undefined,
    }
  }

  try {
    const response = await preferenceClient.create({ body })

    if (!response.id || !response.init_point) {
      throw errors.badGateway('Mercado Pago no devolvió preference_id o init_point')
    }

    return {
      preference_id: response.id,
      init_point: response.init_point,
      sandbox_init_point: response.sandbox_init_point || response.init_point,
    }
  } catch (err: any) {
    console.error('[mercadopago.service] Error creando preference:', err?.message || err)
    if (err?.statusCode) throw err
    throw errors.badGateway(`No se pudo crear la preference de pago: ${err?.message || 'error desconocido'}`)
  }
}

export interface ConsultaPaymentResult {
  id: string
  status: string         // approved, pending, rejected, refunded, etc.
  status_detail: string
  external_reference: string | null
  transaction_amount: number
  currency_id: string
  payer: {
    id?: string
    email?: string
  }
  date_approved: string | null
  date_created: string
  raw: any
}

/**
 * Consulta un payment por su ID en MP.
 * Hace retry con backoff porque MP a veces tiene latencia entre webhook y disponibilidad del recurso.
 */
export async function consultarPayment(
  paymentId: string,
  opts: { retries?: number } = {}
): Promise<ConsultaPaymentResult> {
  assertMpConfigured()
  const maxRetries = opts.retries ?? 3
  const delays = [0, 2000, 4000] // ms

  let lastError: any = null

  for (let i = 0; i < maxRetries; i++) {
    if (delays[i] > 0) await sleep(delays[i])

    try {
      const response = await paymentClient.get({ id: paymentId })

      if (!response.id) {
        lastError = new Error('Payment sin ID en respuesta')
        continue
      }

      return {
        id: String(response.id),
        status: response.status || 'unknown',
        status_detail: response.status_detail || '',
        external_reference: response.external_reference || null,
        transaction_amount: response.transaction_amount || 0,
        currency_id: response.currency_id || 'ARS',
        payer: {
          id: response.payer?.id,
          email: response.payer?.email,
        },
        date_approved: response.date_approved || null,
        date_created: response.date_created || new Date().toISOString(),
        raw: response,
      }
    } catch (err: any) {
      lastError = err
      const status = err?.status || err?.statusCode

      // 404: payment no existe (todavía). Vale la pena reintentar.
      // 5xx: error transitorio de MP. Reintentar.
      // 4xx (no 404): error definitivo, no reintentar.
      if (status && status !== 404 && status < 500) {
        break
      }
    }
  }

  console.error('[mercadopago.service] consultarPayment falló después de', maxRetries, 'intentos:', lastError?.message)
  throw errors.badGateway(`No se pudo consultar el payment ${paymentId} en MP`)
}

/**
 * Valida la firma de un webhook de MP.
 * MP envía headers x-signature y x-request-id.
 *
 * Formato del header x-signature:
 *   ts=1234567890,v1=hash_hex
 *
 * Cálculo:
 *   manifest = id:${data.id};request-id:${x-request-id};ts:${ts};
 *   firma_esperada = HMAC-SHA256(secret, manifest)
 *
 * Si MERCADOPAGO_WEBHOOK_SECRET no está configurado, NO valida (modo permisivo).
 * Esto permite arrancar rápido y endurecer después.
 *
 * Doc oficial: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#bookmark_seguridad_de_la_notificaci%C3%B3n
 */
export function validarFirmaWebhook(opts: {
  xSignature?: string
  xRequestId?: string
  dataId?: string
}): { valida: boolean; razon?: string } {
  if (!MP_CONFIG.webhookSecret) {
    return { valida: true, razon: 'MERCADOPAGO_WEBHOOK_SECRET no configurado, validación omitida' }
  }

  if (!opts.xSignature || !opts.xRequestId || !opts.dataId) {
    return { valida: false, razon: 'Faltan headers x-signature, x-request-id, o data.id' }
  }

  // Parsear x-signature: "ts=...,v1=..."
  const parts = opts.xSignature.split(',').map(p => p.trim())
  const tsPart = parts.find(p => p.startsWith('ts='))
  const v1Part = parts.find(p => p.startsWith('v1='))

  if (!tsPart || !v1Part) {
    return { valida: false, razon: 'x-signature mal formado' }
  }

  const ts = tsPart.substring(3)
  const v1 = v1Part.substring(3)

  const manifest = `id:${opts.dataId};request-id:${opts.xRequestId};ts:${ts};`
  const firmaCalculada = crypto
    .createHmac('sha256', MP_CONFIG.webhookSecret)
    .update(manifest)
    .digest('hex')

  if (firmaCalculada !== v1) {
    return { valida: false, razon: 'Firma no coincide' }
  }

  return { valida: true }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
