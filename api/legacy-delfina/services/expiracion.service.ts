/**
 * Servicio de vencimiento de reservas.
 *
 * Marca como VENCIDO los turnos en PENDIENTE_PAGO_MP o PENDIENTE_VALIDACION_MANUAL
 * cuya reserva_expira_en ya pasó.
 *
 * Para turnos con grupo_reserva_id: vence todos los turnos del grupo juntos.
 *
 * Llamado por n8n cron cada minuto vía POST /turnos/vencer-reservas.
 *
 * Idempotente: si se llama 5 veces seguidas, solo procesa los nuevos vencidos.
 */

import { prisma } from '../lib/prisma'
import { crearNotificacion } from '../lib/notificaciones'

export interface VencerReservasOutput {
  vencidas: number
  ids: string[]
}

export async function vencerReservasExpiradas(): Promise<VencerReservasOutput> {
  const ahora = new Date()

  // Buscar turnos "raíz" a vencer: los que tienen reserva_expira_en vencida
  // y son los primeros de su grupo (tienen PagoSena asociado o no tienen grupo)
  const turnosAVencer = await prisma.turno.findMany({
    where: {
      // PENDIENTE: viene del wizard publico (coordinar_por_whatsapp).
      // PENDIENTE_PAGO_MP: esperando pago de link MP.
      // PENDIENTE_VALIDACION_MANUAL: esperando comprobante de transferencia.
      estado: { in: ['PENDIENTE', 'PENDIENTE_PAGO_MP', 'PENDIENTE_VALIDACION_MANUAL'] },
      reserva_expira_en: { lte: ahora, not: null },
    },
    select: {
      id: true,
      cliente_id: true,
      profesional_id: true,
      fecha: true,
      mp_external_reference: true,
      reserva_expira_en: true,
      grupo_reserva_id: true,
    },
  })

  if (turnosAVencer.length === 0) {
    return { vencidas: 0, ids: [] }
  }

  // Recolectar todos los grupo_reserva_id involucrados
  const gruposAfectados = [...new Set(
    turnosAVencer.map(t => t.grupo_reserva_id).filter(Boolean) as string[]
  )]

  // IDs directos de turnos expirados
  const idsDirectos = turnosAVencer.map(t => t.id)

  // IDs de turnos hermanos del grupo que aún están pendientes
  let idsHermanos: string[] = []
  if (gruposAfectados.length > 0) {
    const hermanos = await prisma.turno.findMany({
      where: {
        grupo_reserva_id: { in: gruposAfectados },
        id: { notIn: idsDirectos },
        estado: { in: ['PENDIENTE_PAGO_MP', 'PENDIENTE_VALIDACION_MANUAL', 'PENDIENTE'] },
      },
      select: { id: true },
    })
    idsHermanos = hermanos.map(h => h.id)
  }

  const todosLosIds = [...idsDirectos, ...idsHermanos]

  // Procesar en transacción para consistencia
  await prisma.$transaction(async tx => {
    // Marcar todos los turnos afectados como VENCIDO
    await tx.turno.updateMany({
      where: { id: { in: todosLosIds } },
      data: { estado: 'VENCIDO' },
    })

    // Marcar PagoSena asociados como VENCIDO (los que estén en CREADO o PENDIENTE)
    await tx.pagoSena.updateMany({
      where: {
        turno_id: { in: todosLosIds },
        status: { in: ['CREADO', 'PENDIENTE'] },
      },
      data: { status: 'VENCIDO' },
    })

    // Log solo para los turnos raíz (evitar ruido por hermanos)
    for (const turno of turnosAVencer) {
      await tx.eventoN8n.create({
        data: {
          workflow_name: 'reserva_vencida',
          estado: 'EXITOSO',
          mensaje: `Turno ${turno.id} vencido (no se pagó la seña a tiempo)${turno.grupo_reserva_id ? `. Grupo ${turno.grupo_reserva_id} vencido completo.` : ''}`,
          referencia_id: turno.id,
          payload: {
            turno_id: turno.id,
            grupo_reserva_id: turno.grupo_reserva_id ?? null,
            ids_hermanos_vencidos: idsHermanos,
            cliente_id: turno.cliente_id,
            profesional_id: turno.profesional_id,
            fecha_turno: turno.fecha.toISOString(),
            external_reference: turno.mp_external_reference,
            expiro_en: turno.reserva_expira_en?.toISOString(),
          },
        },
      })
    }
  })

  // Notificacion global para el admin (una sola que agrupa todos los del tick)
  if (turnosAVencer.length > 0) {
    crearNotificacion({
      tipo: 'TURNO_VENCIDO',
      titulo: turnosAVencer.length === 1 ? 'Una reserva venció' : `${turnosAVencer.length} reservas vencieron`,
      mensaje: turnosAVencer.length === 1
        ? `El turno #${turnosAVencer[0].id.slice(-8).toUpperCase()} venció sin pago confirmado y se liberó el slot.`
        : 'Reservas sin pago vencieron y los slots quedaron libres.',
      referencia_id: turnosAVencer[0].id,
      url_destino: `/admin/turnos/tablero?turno=${turnosAVencer[0].id}`,
    }).catch(() => {})
  }

  return { vencidas: turnosAVencer.length, ids: turnosAVencer.map((t) => t.id) }
}
