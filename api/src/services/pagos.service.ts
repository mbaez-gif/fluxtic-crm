/**
 * Orquestación de pagos de copago / seña previa con Mercado Pago.
 *
 * Reglas críticas:
 * 1. Idempotencia: si payment_id ya tiene un PagoMercadoPago en estado terminal,
 *    no reprocesar.
 * 2. Validación de monto: si el monto recibido difiere del esperado >$1 →
 *    VALIDACION_MANUAL (no confirmar automáticamente).
 * 3. Nunca confiar en el payload del webhook — siempre consultar payment real en MP.
 * 4. Side effects en transacción atómica.
 *
 * Adaptado de Delfina Paz `services/pagos.service.ts` al modelo clínico.
 */

import { prisma } from '../lib/prisma'
import { consultarPayment } from './mercadopago.service'
import { parseExternalReference } from '../utils/external-reference'
import { writeAudit } from '../lib/audit'

export interface ProcesarWebhookInput {
  topic: string
  resourceId: string
}

export type ResultadoProcesamiento =
  | 'idempotente'
  | 'aprobado'
  | 'rechazado'
  | 'pendiente'
  | 'reembolsado'
  | 'validacion_manual'
  | 'ignorado'
  | 'error'

export interface ProcesarWebhookOutput {
  procesado: boolean
  resultado: ResultadoProcesamiento
  pagoMpId?: string
  turnoId?: string
  mensaje: string
}

export async function procesarWebhookMp(input: ProcesarWebhookInput): Promise<ProcesarWebhookOutput> {
  if (input.topic !== 'payment') {
    return { procesado: false, resultado: 'ignorado', mensaje: `Topic "${input.topic}" ignorado` }
  }

  const payment = await consultarPayment(input.resourceId)

  if (!payment.external_reference) {
    return { procesado: false, resultado: 'error', mensaje: 'Payment sin external_reference' }
  }

  const parsed = parseExternalReference(payment.external_reference)
  if (!parsed) {
    return {
      procesado: false,
      resultado: 'error',
      mensaje: `external_reference con formato invalido: ${payment.external_reference}`,
    }
  }

  // Buscar el PagoMercadoPago por external_reference
  const pagoExistente = await prisma.pagoMercadoPago.findUnique({
    where: { external_reference: payment.external_reference },
    include: { turno: true },
  })

  if (!pagoExistente) {
    return {
      procesado: false,
      resultado: 'error',
      mensaje: `No existe PagoMercadoPago para external_reference ${payment.external_reference}`,
    }
  }

  // Idempotencia: si ya tiene payment_id y está en estado terminal, no reprocesar
  const estadosTerminales = ['APROBADO', 'RECHAZADO', 'REEMBOLSADO']
  if (
    pagoExistente.payment_id === String(payment.id) &&
    estadosTerminales.includes(pagoExistente.status)
  ) {
    return {
      procesado: false,
      resultado: 'idempotente',
      pagoMpId: pagoExistente.id,
      turnoId: pagoExistente.turno_id,
      mensaje: `Pago ya en estado ${pagoExistente.status}`,
    }
  }

  // Mapear status MP → nuestro enum
  const statusMp = payment.status
  let nuevoStatus: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' | 'REEMBOLSADO' | 'VALIDACION_MANUAL' = 'PENDIENTE'
  let nuevoEstadoTurno: 'CONFIRMADO' | 'PENDIENTE_VALIDACION_MANUAL' | 'CANCELADO' | null = null
  let resultado: ResultadoProcesamiento = 'pendiente'

  if (statusMp === 'approved') {
    // Validación de monto
    const montoEsperado = Number(pagoExistente.amount)
    const montoRecibido = payment.transaction_amount
    const diferencia = Math.abs(montoEsperado - montoRecibido)

    if (diferencia > 1) {
      nuevoStatus = 'VALIDACION_MANUAL'
      nuevoEstadoTurno = 'PENDIENTE_VALIDACION_MANUAL'
      resultado = 'validacion_manual'
    } else {
      nuevoStatus = 'APROBADO'
      nuevoEstadoTurno = 'CONFIRMADO'
      resultado = 'aprobado'
    }
  } else if (statusMp === 'rejected' || statusMp === 'cancelled') {
    nuevoStatus = 'RECHAZADO'
    nuevoEstadoTurno = 'CANCELADO'
    resultado = 'rechazado'
  } else if (statusMp === 'refunded') {
    nuevoStatus = 'REEMBOLSADO'
    resultado = 'reembolsado'
  } else if (statusMp === 'pending' || statusMp === 'in_process') {
    nuevoStatus = 'PENDIENTE'
    resultado = 'pendiente'
  }

  const ahora = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.pagoMercadoPago.update({
      where: { id: pagoExistente.id },
      data: {
        status: nuevoStatus,
        status_detail: payment.status_detail,
        payment_id: String(payment.id),
        payer_email: payment.payer.email ?? null,
        payer_id: payment.payer.id ?? null,
        raw_payment_response: JSON.stringify(payment.raw),
        approved_at: nuevoStatus === 'APROBADO' ? ahora : null,
        rejected_at: nuevoStatus === 'RECHAZADO' ? ahora : null,
      },
    })

    if (nuevoEstadoTurno) {
      await tx.turno.update({
        where: { id: pagoExistente.turno_id },
        data: {
          estado: nuevoEstadoTurno,
          ...(nuevoEstadoTurno === 'CONFIRMADO' && { reserva_expira_en: null }),
        },
      })
      await tx.cambioEstadoTurno.create({
        data: {
          turno_id: pagoExistente.turno_id,
          estado_anterior: pagoExistente.turno.estado,
          estado_nuevo: nuevoEstadoTurno,
          motivo: `MP webhook: ${resultado}`,
        },
      })
    }
  })

  await writeAudit({
    usuario_id: null,
    accion: 'MODIFICAR',
    entidad: 'PagoMercadoPago',
    entidad_id: pagoExistente.id,
    contexto: { turno_id: pagoExistente.turno_id, payment_id: payment.id, resultado },
    descripcion: `Webhook MP procesado: ${resultado}`,
  })

  return {
    procesado: true,
    resultado,
    pagoMpId: pagoExistente.id,
    turnoId: pagoExistente.turno_id,
    mensaje: `Pago procesado: ${resultado}`,
  }
}
