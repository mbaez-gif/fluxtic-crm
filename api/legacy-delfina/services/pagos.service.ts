/**
 * Servicio de orquestación de pagos.
 *
 * Procesa webhooks de Mercado Pago y orquesta las transiciones de estado
 * del Turno y del PagoSena.
 *
 * Reglas críticas:
 * 1. Idempotencia: si payment_id ya está APROBADO, ignorar silenciosamente.
 * 2. Validación de monto: si no coincide → VALIDACION_MANUAL, no confirmar.
 * 3. Re-validar superposición al confirmar (caso pago tardío con slot tomado).
 * 4. Nunca confiar en el payload del webhook — siempre consultar API real.
 */

import { prisma } from '../lib/prisma'
import { consultarPayment } from './mercadopago.service'
import { detectarSuperposicion } from '../utils/superposicion'
import { parseExternalReference } from '../utils/external-reference'
import { errors } from '../utils/http-errors'
import { crearNotificacion } from '../lib/notificaciones'
import type { PagoSena, Turno } from '@prisma/client'

export interface ProcesarWebhookInput {
  topic: string  // 'payment', 'merchant_order', etc.
  resourceId: string  // ID del payment o merchant_order
}

export interface ProcesarWebhookOutput {
  procesado: boolean
  resultado: 'idempotente' | 'aprobado' | 'rechazado' | 'pendiente' | 'reembolsado' | 'validacion_manual' | 'ignorado' | 'error'
  pagoSenaId?: string
  turnoId?: string
  mensaje: string
}

/**
 * Punto de entrada del webhook MP.
 *
 * Solo procesa topic='payment'. Otros topics se ignoran (200 OK silencioso).
 */
export async function procesarWebhookMp(input: ProcesarWebhookInput): Promise<ProcesarWebhookOutput> {
  // Solo nos interesa "payment" — ignoramos merchant_order y otros
  if (input.topic !== 'payment') {
    return {
      procesado: false,
      resultado: 'ignorado',
      mensaje: `Topic "${input.topic}" ignorado, solo procesamos "payment"`,
    }
  }

  // 1. Consultar payment real en MP
  const payment = await consultarPayment(input.resourceId)

  if (!payment.external_reference) {
    await logEvento('webhook_mp_sin_external_reference', 'ERROR', `Payment ${payment.id} sin external_reference`, payment.raw)
    return {
      procesado: false,
      resultado: 'error',
      mensaje: 'Payment sin external_reference',
    }
  }

  // 2. Resolver el PagoSena por external_reference
  const pagoSena = await prisma.pagoSena.findUnique({
    where: { external_reference: payment.external_reference },
    include: { turno: true },
  })

  if (!pagoSena) {
    await logEvento(
      'webhook_mp_external_reference_desconocida',
      'ERROR',
      `external_reference ${payment.external_reference} no encontrada`,
      { payment_id: payment.id, external_reference: payment.external_reference }
    )
    return {
      procesado: false,
      resultado: 'error',
      mensaje: `external_reference ${payment.external_reference} no encontrada`,
    }
  }

  // 3. Idempotencia: si ya está APROBADO con este mismo payment_id, ignorar
  if (pagoSena.payment_id === payment.id && pagoSena.status === 'APROBADO') {
    return {
      procesado: false,
      resultado: 'idempotente',
      pagoSenaId: pagoSena.id,
      turnoId: pagoSena.turno_id,
      mensaje: 'Webhook ya procesado anteriormente (idempotente)',
    }
  }

  // 4. Validar monto
  const montoEsperado = Number(pagoSena.amount)
  const montoRecibido = payment.transaction_amount

  // Tolerancia de 1 centavo por redondeo de MP
  const diferencia = Math.abs(montoEsperado - montoRecibido)

  if (diferencia > 0.01) {
    await prisma.pagoSena.update({
      where: { id: pagoSena.id },
      data: {
        status: 'VALIDACION_MANUAL',
        status_detail: `Monto no coincide: esperado ${montoEsperado}, recibido ${montoRecibido}`,
        payment_id: payment.id,
        webhook_payload: { topic: input.topic, resourceId: input.resourceId } as any,
        raw_payment_response: payment.raw as any,
      },
    })

    await logEvento(
      'webhook_mp_monto_no_coincide',
      'ERROR',
      `Pago ${payment.id} - monto esperado ${montoEsperado}, recibido ${montoRecibido}`,
      { pago_sena_id: pagoSena.id, turno_id: pagoSena.turno_id, payment }
    )

    return {
      procesado: true,
      resultado: 'validacion_manual',
      pagoSenaId: pagoSena.id,
      turnoId: pagoSena.turno_id,
      mensaje: `Monto no coincide. Marcado como VALIDACION_MANUAL.`,
    }
  }

  // 5. Procesar según status del payment
  switch (payment.status) {
    case 'approved':
      return await aprobarPago(pagoSena, payment)

    case 'pending':
    case 'in_process':
    case 'in_mediation':
      return await marcarPendiente(pagoSena, payment)

    case 'rejected':
    case 'cancelled':
      return await rechazarPago(pagoSena, payment)

    case 'refunded':
    case 'charged_back':
      return await reembolsarPago(pagoSena, payment)

    default:
      await logEvento(
        'webhook_mp_status_desconocido',
        'PENDIENTE',
        `Status desconocido: ${payment.status}`,
        { pago_sena_id: pagoSena.id, payment }
      )
      return {
        procesado: false,
        resultado: 'error',
        pagoSenaId: pagoSena.id,
        turnoId: pagoSena.turno_id,
        mensaje: `Status MP desconocido: ${payment.status}`,
      }
  }
}

/**
 * Aprobar pago + confirmar turno.
 * Re-valida superposición (caso pago tardío con slot ya tomado).
 * Todo en transacción.
 */
async function aprobarPago(
  pagoSena: PagoSena & { turno: Turno },
  payment: any
): Promise<ProcesarWebhookOutput> {
  return await prisma.$transaction(async tx => {
    // Recargar turno fresco
    const turno = await tx.turno.findUnique({ where: { id: pagoSena.turno_id } })
    if (!turno) {
      throw errors.notFound('Turno')
    }

    // Si ya está confirmado, idempotente
    if (turno.estado === 'CONFIRMADO') {
      // Solo actualizamos pago si todavía no estaba marcado
      if (pagoSena.status !== 'APROBADO') {
        await tx.pagoSena.update({
          where: { id: pagoSena.id },
          data: {
            status: 'APROBADO',
            payment_id: payment.id,
            payer_email: payment.payer.email,
            payer_id: payment.payer.id,
            approved_at: new Date(payment.date_approved || Date.now()),
            raw_payment_response: payment.raw as any,
          },
        })
      }
      return {
        procesado: false,
        resultado: 'idempotente' as const,
        pagoSenaId: pagoSena.id,
        turnoId: turno.id,
        mensaje: 'Turno ya estaba confirmado',
      }
    }

    // Si turno está CANCELADO, RECHAZADO o COMPLETADO → no podemos revivir
    if (['CANCELADO', 'RECHAZADO', 'COMPLETADO', 'NO_SHOW'].includes(turno.estado)) {
      // Pago tardío sobre un turno ya cerrado → marcamos para reembolso manual
      await tx.pagoSena.update({
        where: { id: pagoSena.id },
        data: {
          status: 'REEMBOLSADO',
          status_detail: `Pago aprobado sobre turno en estado ${turno.estado}. Requiere reembolso manual.`,
          payment_id: payment.id,
          payer_email: payment.payer.email,
          payer_id: payment.payer.id,
          raw_payment_response: payment.raw as any,
        },
      })

      await tx.eventoN8n.create({
        data: {
          workflow_name: 'pago_aprobado_sobre_turno_cerrado',
          estado: 'ERROR',
          mensaje: `Pago ${payment.id} aprobado sobre turno ${turno.id} en estado ${turno.estado}. Requiere reembolso manual.`,
          referencia_id: turno.id,
          payload: { turno_id: turno.id, payment_id: payment.id, estado_turno: turno.estado },
        },
      })

      return {
        procesado: true,
        resultado: 'reembolsado' as const,
        pagoSenaId: pagoSena.id,
        turnoId: turno.id,
        mensaje: `Pago aprobado sobre turno ${turno.estado}. Marcado para reembolso manual.`,
      }
    }

    // Re-validar superposición (caso: pago tardío con slot ya tomado por otro)
    const superposicion = await detectarSuperposicion(tx, {
      profesional_id: turno.profesional_id,
      fecha_inicio: turno.fecha,
      duracion_min: turno.duracion_min,
      buffer_min: 0, // ya está cargado el buffer en el calculo, lo pasamos sin doble
      turno_id_excluir: turno.id,
    })

    if (superposicion.hay_conflicto) {
      // Slot tomado en el ínterin. No podemos confirmar.
      await tx.turno.update({
        where: { id: turno.id },
        data: { estado: 'VENCIDO' },
      })

      await tx.pagoSena.update({
        where: { id: pagoSena.id },
        data: {
          status: 'REEMBOLSADO',
          status_detail: `Pago tardío. Slot ya fue tomado por turno ${superposicion.turno_conflicto?.id}. Requiere reembolso manual.`,
          payment_id: payment.id,
          payer_email: payment.payer.email,
          payer_id: payment.payer.id,
          raw_payment_response: payment.raw as any,
        },
      })

      await tx.eventoN8n.create({
        data: {
          workflow_name: 'pago_aprobado_slot_tomado',
          estado: 'ERROR',
          mensaje: `Pago aprobado pero slot ya tomado. Requiere reembolso manual.`,
          referencia_id: turno.id,
          payload: { turno_id: turno.id, payment_id: payment.id, conflicto: superposicion.turno_conflicto },
        },
      })

      return {
        procesado: true,
        resultado: 'reembolsado' as const,
        pagoSenaId: pagoSena.id,
        turnoId: turno.id,
        mensaje: 'Slot tomado en el ínterin. Pago marcado para reembolso manual.',
      }
    }

    // OK — confirmar turno y aprobar pago
    await tx.turno.update({
      where: { id: turno.id },
      data: {
        estado: 'CONFIRMADO',
        reserva_expira_en: null,
      },
    })

    // Si es parte de un grupo multi-servicio, confirmar todos los turnos hermanos
    let turnosGrupoConfirmados = 0
    if (turno.grupo_reserva_id) {
      const otrosTurnos = await tx.turno.findMany({
        where: {
          grupo_reserva_id: turno.grupo_reserva_id,
          id: { not: turno.id },
          estado: { in: ['PENDIENTE_PAGO_MP', 'PENDIENTE'] },
        },
      })

      if (otrosTurnos.length > 0) {
        await tx.turno.updateMany({
          where: {
            grupo_reserva_id: turno.grupo_reserva_id,
            id: { not: turno.id },
            estado: { in: ['PENDIENTE_PAGO_MP', 'PENDIENTE'] },
          },
          data: {
            estado: 'CONFIRMADO',
            reserva_expira_en: null,
          },
        })
        turnosGrupoConfirmados = otrosTurnos.length
      }
    }

    await tx.pagoSena.update({
      where: { id: pagoSena.id },
      data: {
        status: 'APROBADO',
        status_detail: payment.status_detail,
        payment_id: payment.id,
        payer_email: payment.payer.email,
        payer_id: payment.payer.id,
        approved_at: new Date(payment.date_approved || Date.now()),
        raw_payment_response: payment.raw as any,
      },
    })

    await tx.eventoN8n.create({
      data: {
        workflow_name: 'pago_aprobado',
        estado: 'EXITOSO',
        mensaje: `Pago ${payment.id} aprobado. Turno ${turno.id} CONFIRMADO.${turnosGrupoConfirmados > 0 ? ` (+ ${turnosGrupoConfirmados} turno(s) del grupo confirmados)` : ''}`,
        referencia_id: turno.id,
        payload: {
          turno_id: turno.id,
          grupo_reserva_id: turno.grupo_reserva_id || null,
          turnos_grupo_confirmados: turnosGrupoConfirmados,
          payment_id: payment.id,
          monto: payment.transaction_amount,
        },
      },
    })

    crearNotificacion({
      tipo: 'PAGO_APROBADO',
      titulo: 'Seña pagada por Mercado Pago',
      mensaje: `Llegó el pago del turno #${turno.id.slice(-8).toUpperCase()}. El turno quedó CONFIRMADO automáticamente.`,
      referencia_id: turno.id,
      url_destino: `/admin/turnos/tablero?turno=${turno.id}`,
    }).catch(() => {})

    return {
      procesado: true,
      resultado: 'aprobado' as const,
      pagoSenaId: pagoSena.id,
      turnoId: turno.id,
      mensaje: `Turno ${turno.id} confirmado.`,
    }
  })
}

async function marcarPendiente(
  pagoSena: PagoSena & { turno: Turno },
  payment: any
): Promise<ProcesarWebhookOutput> {
  await prisma.pagoSena.update({
    where: { id: pagoSena.id },
    data: {
      status: 'PENDIENTE',
      status_detail: payment.status_detail,
      payment_id: payment.id,
      payer_email: payment.payer.email,
      payer_id: payment.payer.id,
      raw_payment_response: payment.raw as any,
    },
  })

  await logEvento(
    'pago_pendiente',
    'PENDIENTE',
    `Pago ${payment.id} pendiente (${payment.status_detail})`,
    { turno_id: pagoSena.turno_id, payment_id: payment.id }
  )

  return {
    procesado: true,
    resultado: 'pendiente',
    pagoSenaId: pagoSena.id,
    turnoId: pagoSena.turno_id,
    mensaje: 'Pago marcado como pendiente',
  }
}

async function rechazarPago(
  pagoSena: PagoSena & { turno: Turno },
  payment: any
): Promise<ProcesarWebhookOutput> {
  return await prisma.$transaction(async tx => {
    await tx.pagoSena.update({
      where: { id: pagoSena.id },
      data: {
        status: 'RECHAZADO',
        status_detail: payment.status_detail,
        payment_id: payment.id,
        payer_email: payment.payer.email,
        payer_id: payment.payer.id,
        rejected_at: new Date(),
        raw_payment_response: payment.raw as any,
      },
    })

    // Si el turno aún está PENDIENTE_PAGO_MP, lo pasamos a RECHAZADO (libera slot)
    const turno = await tx.turno.findUnique({ where: { id: pagoSena.turno_id } })
    if (turno && turno.estado === 'PENDIENTE_PAGO_MP') {
      await tx.turno.update({
        where: { id: turno.id },
        data: { estado: 'RECHAZADO', reserva_expira_en: null },
      })

      // Rechazar también los turnos hermanos del grupo
      if (turno.grupo_reserva_id) {
        await tx.turno.updateMany({
          where: {
            grupo_reserva_id: turno.grupo_reserva_id,
            id: { not: turno.id },
            estado: { in: ['PENDIENTE_PAGO_MP', 'PENDIENTE'] },
          },
          data: { estado: 'RECHAZADO', reserva_expira_en: null },
        })
      }
    }

    await tx.eventoN8n.create({
      data: {
        workflow_name: 'pago_rechazado',
        estado: 'EXITOSO',
        mensaje: `Pago ${payment.id} rechazado: ${payment.status_detail}`,
        referencia_id: pagoSena.turno_id,
        payload: { turno_id: pagoSena.turno_id, payment_id: payment.id, status_detail: payment.status_detail },
      },
    })

    crearNotificacion({
      tipo: 'PAGO_RECHAZADO',
      titulo: 'Pago rechazado',
      mensaje: `Mercado Pago rechazó el pago del turno #${pagoSena.turno_id.slice(-8).toUpperCase()}. El slot quedó liberado.`,
      referencia_id: pagoSena.turno_id,
      url_destino: `/admin/turnos/tablero?turno=${pagoSena.turno_id}`,
    }).catch(() => {})

    return {
      procesado: true,
      resultado: 'rechazado' as const,
      pagoSenaId: pagoSena.id,
      turnoId: pagoSena.turno_id,
      mensaje: `Pago rechazado: ${payment.status_detail}. Slot liberado.`,
    }
  })
}

async function reembolsarPago(
  pagoSena: PagoSena & { turno: Turno },
  payment: any
): Promise<ProcesarWebhookOutput> {
  await prisma.pagoSena.update({
    where: { id: pagoSena.id },
    data: {
      status: 'REEMBOLSADO',
      status_detail: payment.status_detail || payment.status,
      payment_id: payment.id,
      raw_payment_response: payment.raw as any,
    },
  })

  await logEvento(
    'pago_reembolsado',
    'EXITOSO',
    `Pago ${payment.id} reembolsado/contracargo`,
    { turno_id: pagoSena.turno_id, payment_id: payment.id }
  )

  return {
    procesado: true,
    resultado: 'reembolsado',
    pagoSenaId: pagoSena.id,
    turnoId: pagoSena.turno_id,
    mensaje: 'Pago reembolsado',
  }
}

async function logEvento(workflowName: string, estado: 'EXITOSO' | 'ERROR' | 'PENDIENTE', mensaje: string, payload: any): Promise<void> {
  try {
    await prisma.eventoN8n.create({
      data: {
        workflow_name: workflowName,
        estado,
        mensaje,
        payload: payload as any,
      },
    })
  } catch (err) {
    // No queremos que un fallo de log haga fallar el flujo principal
    console.error('[pagos.service] Error guardando log:', err)
  }
}

/**
 * Reconcilia un pago consultando MP directamente.
 * Útil para n8n cron (red de seguridad por si un webhook se perdió).
 */
export async function reconciliarPago(pagoSenaId: string): Promise<ProcesarWebhookOutput> {
  const pagoSena = await prisma.pagoSena.findUnique({ where: { id: pagoSenaId } })
  if (!pagoSena) {
    throw errors.notFound('PagoSena')
  }

  if (!pagoSena.payment_id) {
    return {
      procesado: false,
      resultado: 'ignorado',
      mensaje: 'Pago todavía no tiene payment_id (clienta no llegó a pagar)',
    }
  }

  return await procesarWebhookMp({ topic: 'payment', resourceId: pagoSena.payment_id })
}
