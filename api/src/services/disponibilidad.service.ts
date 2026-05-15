/**
 * Servicio de cálculo de disponibilidad.
 *
 * Calcula slots disponibles para un servicio dado, considerando:
 * - Horarios de trabajo del profesional (HorarioProfesional)
 * - Turnos existentes que bloquean (con su buffer)
 * - Duración del servicio + buffer del servicio
 *
 * NOTA: por decisión de producto, el buffer NO se descuenta de los slots visibles.
 * La clienta ve slots según horario y turnos existentes; la validación final
 * con buffer ocurre en reservas.service al momento de crear el turno.
 */

import { prisma } from '../lib/prisma'
import { ESTADOS_BLOQUEANTES } from '../utils/superposicion'

export interface SlotDisponible {
  inicio: string  // ISO 8601
  fin: string     // ISO 8601 (inicio + duracion_min)
}

export interface DisponibilidadInput {
  servicio_id: string
  profesional_id?: string  // si no se pasa, busca para todas las profesionales
  fecha_desde: Date
  fecha_hasta: Date
  granularidad_min?: number  // default 30
}

export interface DisponibilidadOutput {
  servicio: {
    id: string
    nombre: string
    duracion_min: number
    buffer_min: number
    precio: number
  }
  por_profesional: Array<{
    profesional_id: string
    profesional_nombre: string
    slots: SlotDisponible[]
  }>
}

/**
 * Calcula slots disponibles.
 *
 * Algoritmo:
 * 1. Cargar servicio (necesitamos duracion_min y buffer_min)
 * 2. Cargar profesionales activas (todas o la pedida)
 * 3. Para cada profesional:
 *    a. Cargar sus horarios por dia_semana
 *    b. Cargar sus turnos existentes en el rango [fecha_desde, fecha_hasta]
 *    c. Para cada día del rango:
 *       - Obtener bloques de horario activos para ese día
 *       - Generar slots cada `granularidad_min` minutos
 *       - Filtrar slots que se superponen con turnos existentes (con buffer)
 *       - Filtrar slots que no entran completos en el bloque de horario
 *       - Filtrar slots en el pasado (si fecha_desde es hoy)
 * 4. Devolver slots por profesional
 */
export async function calcularDisponibilidad(input: DisponibilidadInput): Promise<DisponibilidadOutput> {
  const granularidad = input.granularidad_min ?? 30

  // 1. Cargar servicio
  const servicio = await prisma.servicio.findUnique({
    where: { id: input.servicio_id, activo: true },
  })
  if (!servicio) {
    const err: any = new Error('Servicio no encontrado o inactivo')
    err.statusCode = 404
    throw err
  }

  // 2. Cargar profesionales con sus horarios
  const profesionales = await prisma.usuario.findMany({
    where: {
      activo: true,
      rol: { in: ['OWNER', 'ADMIN', 'EMPLEADA'] },
      ...(input.profesional_id ? { id: input.profesional_id } : {}),
      // Solo profesionales con al menos un horario activo
      horarios: { some: { activo: true } },
    },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      horarios: {
        where: { activo: true },
        select: { dia_semana: true, hora_inicio: true, hora_fin: true },
      },
    },
  })

  // 3. Cargar turnos existentes en el rango (una sola query)
  const turnosBloqueantes = await prisma.turno.findMany({
    where: {
      profesional_id: { in: profesionales.map(p => p.id) },
      fecha: { gte: input.fecha_desde, lte: input.fecha_hasta },
      estado: { in: ESTADOS_BLOQUEANTES as any },
    },
    select: {
      profesional_id: true,
      fecha: true,
      duracion_min: true,
      servicio: { select: { buffer_min: true } },
    },
  })

  // 4. Calcular slots por profesional
  const ahora = new Date()
  const por_profesional = profesionales.map(prof => {
    const turnosProf = turnosBloqueantes.filter(t => t.profesional_id === prof.id)
    const slots: SlotDisponible[] = []

    // Iterar día por día desde fecha_desde hasta fecha_hasta
    const dia = new Date(input.fecha_desde)
    dia.setHours(0, 0, 0, 0)
    const diaFin = new Date(input.fecha_hasta)
    diaFin.setHours(23, 59, 59, 999)

    while (dia <= diaFin) {
      const diaSemana = dia.getDay() // 0=domingo, 6=sábado

      // Bloques de horario activos para este día
      const bloques = prof.horarios.filter(h => h.dia_semana === diaSemana)

      for (const bloque of bloques) {
        // Generar slots dentro de este bloque
        const slotsDelBloque = generarSlotsDeBloque({
          dia,
          horaInicio: bloque.hora_inicio,
          horaFin: bloque.hora_fin,
          duracionServicio: servicio.duracion_min,
          granularidad,
        })

        // Filtrar slots que están en el pasado
        const slotsNoVencidos = slotsDelBloque.filter(s => new Date(s.inicio) > ahora)

        // Filtrar slots ocupados por turnos existentes (con buffer del turno existente)
        const slotsLibres = slotsNoVencidos.filter(slot => {
          const slotInicio = new Date(slot.inicio).getTime()
          const slotFin = new Date(slot.fin).getTime()

          for (const turno of turnosProf) {
            const turnoInicio = turno.fecha.getTime()
            const turnoFinEfectivo =
              turnoInicio + (turno.duracion_min + turno.servicio.buffer_min) * 60 * 1000

            // Overlap check (sin contar buffer del slot nuevo, solo del existente)
            if (slotInicio < turnoFinEfectivo && slotFin > turnoInicio) {
              return false
            }
          }
          return true
        })

        slots.push(...slotsLibres)
      }

      dia.setDate(dia.getDate() + 1)
    }

    return {
      profesional_id: prof.id,
      profesional_nombre: `${prof.nombre}${prof.apellido ? ' ' + prof.apellido : ''}`,
      slots,
    }
  })

  return {
    servicio: {
      id: servicio.id,
      nombre: servicio.nombre,
      duracion_min: servicio.duracion_min,
      buffer_min: servicio.buffer_min,
      precio: Number(servicio.precio),
    },
    por_profesional,
  }
}

/**
 * Genera slots dentro de un bloque de horario.
 * Solo incluye slots cuyo fin (inicio + duracion) entra en el bloque.
 */
function generarSlotsDeBloque(opts: {
  dia: Date
  horaInicio: string  // "HH:mm"
  horaFin: string     // "HH:mm"
  duracionServicio: number
  granularidad: number
}): SlotDisponible[] {
  const slots: SlotDisponible[] = []

  const [hIni, mIni] = opts.horaInicio.split(':').map(Number)
  const [hFin, mFin] = opts.horaFin.split(':').map(Number)

  const inicioBloque = new Date(opts.dia)
  inicioBloque.setHours(hIni, mIni, 0, 0)

  const finBloque = new Date(opts.dia)
  finBloque.setHours(hFin, mFin, 0, 0)

  let cursor = new Date(inicioBloque)

  while (cursor < finBloque) {
    const finSlot = new Date(cursor.getTime() + opts.duracionServicio * 60 * 1000)

    // Solo incluir si el servicio cabe completo dentro del bloque
    if (finSlot <= finBloque) {
      slots.push({
        inicio: cursor.toISOString(),
        fin: finSlot.toISOString(),
      })
    }

    cursor = new Date(cursor.getTime() + opts.granularidad * 60 * 1000)
  }

  return slots
}
