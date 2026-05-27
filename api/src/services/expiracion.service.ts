/**
 * Servicio de expiración de reservas pendientes de pago.
 *
 * Cuando se crea un turno con copago vía Mercado Pago, se setea
 * `Turno.reserva_expira_en = now + RESERVA_EXPIRACION_MINUTOS`. Si el paciente
 * no completa el pago en ese plazo, el cron lo marca como VENCIDO y libera el slot.
 *
 * Disparado por n8n: `POST /turnos/vencer-reservas` con `x-internal-token`.
 *
 * Adaptado de Delfina Paz `services/expiracion.service.ts`.
 */

import { prisma } from '../lib/prisma'

export interface ResultadoExpiracion {
  ok: boolean
  vencidos: number
  ids: string[]
}

export async function vencerReservasExpiradas(): Promise<ResultadoExpiracion> {
  const ahora = new Date()

  // Buscar turnos pendientes de pago cuyo reserva_expira_en ya pasó
  const candidatos = await prisma.turno.findMany({
    where: {
      estado: { in: ['PENDIENTE_PAGO_MP', 'PENDIENTE_VALIDACION_MANUAL'] },
      reserva_expira_en: { lt: ahora },
    },
    select: { id: true },
  })

  if (candidatos.length === 0) {
    return { ok: true, vencidos: 0, ids: [] }
  }

  const ids = candidatos.map((t) => t.id)

  await prisma.$transaction(async (tx) => {
    await tx.turno.updateMany({
      where: { id: { in: ids } },
      data: { estado: 'VENCIDO' },
    })

    // Marcar también los pagos asociados como vencidos
    await tx.pagoMercadoPago.updateMany({
      where: { turno_id: { in: ids }, status: { in: ['CREADO', 'PENDIENTE'] } },
      data: { status: 'VENCIDO' },
    })

    // Registrar cambio de estado
    for (const id of ids) {
      await tx.cambioEstadoTurno.create({
        data: {
          turno_id: id,
          estado_nuevo: 'VENCIDO',
          motivo: 'Reserva expirada (sin pago de copago en plazo)',
        },
      })
    }
  })

  return { ok: true, vencidos: ids.length, ids }
}
