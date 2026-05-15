/**
 * Algoritmo de detección de superposición entre turnos.
 *
 * Reglas:
 * - El "fin efectivo" de un turno es: fecha + duracion_min + buffer_min
 * - Dos turnos del mismo profesional se superponen si sus intervalos efectivos se solapan
 * - Estados que bloquean: PENDIENTE, PENDIENTE_PAGO_MP, PENDIENTE_VALIDACION_MANUAL,
 *   CONFIRMADO, EN_CURSO
 * - Estados que liberan: COMPLETADO, CANCELADO, NO_SHOW, VENCIDO, RECHAZADO
 *
 * Usado en 3 lugares:
 * 1. Al crear pre-reserva (reservas.service.ts)
 * 2. Al confirmar pago (pagos.service.ts) — validación final
 * 3. Al cambiar fecha/hora de un turno existente (turnos.ts route)
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { HttpError } from './http-errors'

export const ESTADOS_BLOQUEANTES = [
  'PENDIENTE',
  'PENDIENTE_PAGO_MP',
  'PENDIENTE_VALIDACION_MANUAL',
  'CONFIRMADO',
  'EN_CURSO',
] as const

export interface SuperposicionInput {
  profesional_id: string
  fecha_inicio: Date
  duracion_min: number
  buffer_min: number
  turno_id_excluir?: string | null
}

export interface SuperposicionResult {
  hay_conflicto: boolean
  turno_conflicto?: {
    id: string
    fecha: Date
    duracion_min: number
    buffer_min: number
    cliente_id: string
    estado: string
  }
}

/**
 * Detecta si un turno propuesto se superpone con turnos existentes.
 * Acepta tanto PrismaClient como TransactionClient (para usar dentro de transacciones).
 */
export async function detectarSuperposicion(
  db: PrismaClient | Prisma.TransactionClient,
  input: SuperposicionInput
): Promise<SuperposicionResult> {
  const { profesional_id, fecha_inicio, duracion_min, buffer_min, turno_id_excluir } = input

  const fecha_fin_efectivo = new Date(
    fecha_inicio.getTime() + (duracion_min + buffer_min) * 60 * 1000
  )

  // Query SQL raw porque Prisma no soporta bien el cálculo de fin efectivo con join.
  // Alternativa con queryRaw para garantizar el cálculo correcto del overlap.
  const conflictos = await db.$queryRaw<Array<{
    id: string
    fecha: Date
    duracion_min: number
    buffer_min: number
    cliente_id: string
    estado: string
  }>>`
    SELECT t.id, t.fecha, t.duracion_min, s.buffer_min, t.cliente_id, t.estado::text as estado
    FROM turnos t
    JOIN servicios s ON s.id = t.servicio_id
    WHERE t.profesional_id = ${profesional_id}
      AND t.estado::text IN ('PENDIENTE', 'PENDIENTE_PAGO_MP', 'PENDIENTE_VALIDACION_MANUAL', 'CONFIRMADO', 'EN_CURSO')
      AND ${turno_id_excluir ? Prisma.sql`t.id != ${turno_id_excluir}` : Prisma.sql`TRUE`}
      AND t.fecha < ${fecha_fin_efectivo}
      AND (t.fecha + ((t.duracion_min + s.buffer_min) || ' minutes')::interval) > ${fecha_inicio}
    LIMIT 1
  `

  if (conflictos.length === 0) {
    return { hay_conflicto: false }
  }

  return {
    hay_conflicto: true,
    turno_conflicto: conflictos[0],
  }
}

/**
 * Helper que tira HttpError(409) si hay conflicto.
 */
export async function asegurarSinSuperposicion(
  db: PrismaClient | Prisma.TransactionClient,
  input: SuperposicionInput
): Promise<void> {
  const result = await detectarSuperposicion(db, input)
  if (result.hay_conflicto) {
    throw new HttpError(
      409,
      'El horario seleccionado ya no está disponible. Elegí otro horario.',
      'SLOT_NO_DISPONIBLE',
      { turno_conflicto: result.turno_conflicto },
    )
  }
}
