/**
 * Singleton del SDK de Mercado Pago (v2.x).
 *
 * Toda la comunicación con MP pasa por acá. NO importar mercadopago directo
 * desde otros archivos — siempre usar este wrapper.
 *
 * Variables de entorno requeridas:
 *   MERCADOPAGO_ACCESS_TOKEN — token de producción (APP_USR-...)
 *
 * Variables opcionales:
 *   MERCADOPAGO_WEBHOOK_SECRET — para validar firma de webhooks
 *   MERCADOPAGO_NOTIFICATION_URL — URL del webhook (default: https://api-delfina.fluxtic.com/webhooks/mercadopago)
 *   MERCADOPAGO_SUCCESS_URL / PENDING_URL / FAILURE_URL — URLs de retorno
 */

import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

if (!accessToken) {
  console.warn('[mercadopago] MERCADOPAGO_ACCESS_TOKEN no está configurado. Las llamadas a MP fallarán.')
}

export const mpClient = new MercadoPagoConfig({
  accessToken: accessToken || 'NOT_CONFIGURED',
  options: {
    timeout: 10000, // 10 segundos
    idempotencyKey: undefined, // se setea por request
  },
})

export const preferenceClient = new Preference(mpClient)
export const paymentClient = new Payment(mpClient)

export const MP_CONFIG = {
  notificationUrl:
    process.env.MERCADOPAGO_NOTIFICATION_URL ||
    'https://api-delfina.fluxtic.com/webhooks/mercadopago',
  successUrl:
    process.env.MERCADOPAGO_SUCCESS_URL ||
    'https://admin-delfina.fluxtic.com/pago/success',
  pendingUrl:
    process.env.MERCADOPAGO_PENDING_URL ||
    'https://admin-delfina.fluxtic.com/pago/pending',
  failureUrl:
    process.env.MERCADOPAGO_FAILURE_URL ||
    'https://admin-delfina.fluxtic.com/pago/failure',
  webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
  isConfigured: !!accessToken,
}

/**
 * Helper para validar que MP esté configurado antes de operar.
 * Lo usan los servicios para fallar rápido con error claro.
 */
export function assertMpConfigured(): void {
  if (!MP_CONFIG.isConfigured) {
    throw new Error(
      'Mercado Pago no está configurado. Agregar MERCADOPAGO_ACCESS_TOKEN al .env'
    )
  }
}
