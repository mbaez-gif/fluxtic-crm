/**
 * Servicio de cálculo de disponibilidad de turnos.
 *
 * Adaptado del algoritmo maduro de Delfina Paz al dominio clínico.
 *
 * Considera:
 *  - Horarios de trabajo del profesional (HorarioProfesional)
 *  - Sede asignada al horario (opcional)
 *  - Turnos existentes en estados bloqueantes
 *  - Duración de la prestación (no buffer por defecto)
 */

import { prisma } from '../lib/prisma'
import type { EstadoTurno } from '@prisma/client'

export const ESTADOS_BLOQUEANTES: EstadoTurno[] = [
  'PENDIENTE',
  'PENDIENTE_PAGO_MP',
  'PENDIENTE_VALIDACION_MANUAL',
  'CONFIRMADO',
  'EN_SALA_ESPERA',
  'EN_ATENCION',
]

export interface SlotDisponible {
  inicio: string
  fin: string
}

export interface DisponibilidadInput {
  prestacion_id: string
  profesional_id?: string
  sede_id?: string
  especialidad_id?: string
  fecha_desde: Date
  fecha_hasta: Date
  granularidad_min?: number
}

export interface DisponibilidadOutput {
  prestacion: {
    id: string
    nombre: string
    duracion_min: number
    precio_particular: number
    requiere_autorizacion: boolean
    requiere_preparacion: boolean
  }
  por_profesional: Array<{
    profesional_id: string
    profesional_nombre: string
    matricula: string
    especialidad: string
    sedes: Array<{ id: string; nombre: string }>
    slots: SlotDisponible[]
  }>
}

export async function calcularDisponibilidad(input: DisponibilidadInput): Promise<DisponibilidadOutput> {
  const granularidad = input.granularidad_min ?? 30

  const prestacion = await prisma.prestacion.findUnique({
    where: { id: input.prestacion_id },
  })
  if (!prestacion || !prestacion.activa) {
    const err: any = new Error('Prestación no encontrada o inactiva')
    err.statusCode = 404
    throw err
  }

  // Buscar profesionales habilitados para esta prestación
  const profesionales = await prisma.perfilProfesional.findMany({
    where: {
      ...(input.profesional_id ? { id: input.profesional_id } : {}),
      ...(input.especialidad_id ? { especialidad_id: input.especialidad_id } : {}),
      usuario: { activo: true },
      horarios: { some: { activo: true } },
      prestaciones: { some: { prestacion_id: input.prestacion_id } },
      ...(input.sede_id ? { sedes: { some: { sede_id: input.sede_id } } } : {}),
    },
    select: {
      id: true,
      matricula: true,
      usuario: { select: { nombre: true, apellido: true } },
      especialidad: { select: { nombre: true } },
      sedes: { include: { sede: { select: { id: true, nombre: true } } } },
      horarios: {
        where: {
          activo: true,
          ...(input.sede_id ? { OR: [{ sede_id: input.sede_id }, { sede_id: null }] } : {}),
        },
        select: { dia_semana: true, hora_inicio: true, hora_fin: true, sede_id: true },
      },
    },
  })

  // Cargar todos los turnos bloqueantes en una query
  const turnosBloqueantes = await prisma.turno.findMany({
    where: {
      profesional_id: { in: profesionales.map((p) => p.id) },
      fecha_hora: { gte: input.fecha_desde, lte: input.fecha_hasta },
      estado: { in: ESTADOS_BLOQUEANTES },
      ...(input.sede_id ? { sede_id: input.sede_id } : {}),
    },
    select: { profesional_id: true, fecha_hora: true, duracion_min: true },
  })

  const ahora = new Date()
  const por_profesional = profesionales.map((prof) => {
    const turnosProf = turnosBloqueantes.filter((t) => t.profesional_id === prof.id)
    const slots: SlotDisponible[] = []

    const dia = new Date(input.fecha_desde)
    dia.setHours(0, 0, 0, 0)
    const diaFin = new Date(input.fecha_hasta)
    diaFin.setHours(23, 59, 59, 999)

    while (dia <= diaFin) {
      const diaSemana = dia.getDay()
      const bloques = prof.horarios.filter((h) => h.dia_semana === diaSemana)

      for (const bloque of bloques) {
        const slotsDelBloque = generarSlotsDeBloque({
          dia,
          horaInicio: bloque.hora_inicio,
          horaFin: bloque.hora_fin,
          duracionPrestacion: prestacion.duracion_min,
          granularidad,
        })

        const slotsNoVencidos = slotsDelBloque.filter((s) => new Date(s.inicio) > ahora)

        const slotsLibres = slotsNoVencidos.filter((slot) => {
          const slotInicio = new Date(slot.inicio).getTime()
          const slotFin = new Date(slot.fin).getTime()
          for (const turno of turnosProf) {
            const turnoInicio = turno.fecha_hora.getTime()
            const turnoFin = turnoInicio + turno.duracion_min * 60 * 1000
            if (slotInicio < turnoFin && slotFin > turnoInicio) {
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
      profesional_nombre: `${prof.usuario.apellido ?? ''}, ${prof.usuario.nombre}`.trim().replace(/^,\s*/, ''),
      matricula: prof.matricula,
      especialidad: prof.especialidad.nombre,
      sedes: prof.sedes.map((s) => ({ id: s.sede.id, nombre: s.sede.nombre })),
      slots,
    }
  })

  return {
    prestacion: {
      id: prestacion.id,
      nombre: prestacion.nombre,
      duracion_min: prestacion.duracion_min,
      precio_particular: Number(prestacion.precio_particular),
      requiere_autorizacion: prestacion.requiere_autorizacion,
      requiere_preparacion: prestacion.requiere_preparacion,
    },
    por_profesional,
  }
}

function generarSlotsDeBloque(opts: {
  dia: Date
  horaInicio: string
  horaFin: string
  duracionPrestacion: number
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
    const finSlot = new Date(cursor.getTime() + opts.duracionPrestacion * 60 * 1000)
    if (finSlot <= finBloque) {
      slots.push({ inicio: cursor.toISOString(), fin: finSlot.toISOString() })
    }
    cursor = new Date(cursor.getTime() + opts.granularidad * 60 * 1000)
  }
  return slots
}
