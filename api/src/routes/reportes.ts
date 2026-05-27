/**
 * Reportes clínicos y administrativos.
 * Adaptado de Delfina Paz al dominio salud.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { parseOrFail } from '../lib/zod-helpers'

const rangoSchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
})

function parsearRango(q: any) {
  const r = parseOrFail(rangoSchema, q)
  const hasta = r.hasta ? new Date(r.hasta) : new Date()
  const desde = r.desde ? new Date(r.desde) : new Date(hasta.getTime() - 30 * 24 * 3600 * 1000)
  return { desde, hasta }
}

export async function reportesRoutes(app: FastifyInstance) {
  // Resumen general del período
  app.get('/resumen', async (request) => {
    request.requirePermiso('reporte:ver')
    const { desde, hasta } = parsearRango(request.query)

    const [turnos, atendidos, noShow, cancelados, ingresos, pacientesNuevos] = await Promise.all([
      prisma.turno.count({ where: { fecha_hora: { gte: desde, lte: hasta } } }),
      prisma.turno.count({ where: { fecha_hora: { gte: desde, lte: hasta }, estado: 'ATENDIDO' } }),
      prisma.turno.count({ where: { fecha_hora: { gte: desde, lte: hasta }, estado: 'AUSENTE' } }),
      prisma.turno.count({ where: { fecha_hora: { gte: desde, lte: hasta }, estado: 'CANCELADO' } }),
      prisma.pago.aggregate({
        where: { fecha: { gte: desde, lte: hasta } },
        _sum: { monto: true },
        _count: true,
      }),
      prisma.paciente.count({ where: { created_at: { gte: desde, lte: hasta } } }),
    ])

    return {
      periodo: { desde, hasta },
      turnos_total: turnos,
      atendidos,
      no_show: noShow,
      cancelados,
      tasa_atencion: turnos > 0 ? Math.round((atendidos / turnos) * 100) : 0,
      tasa_no_show: turnos > 0 ? Math.round((noShow / turnos) * 100) : 0,
      ingresos: {
        total: Number(ingresos._sum.monto ?? 0),
        cantidad_pagos: ingresos._count,
      },
      pacientes_nuevos: pacientesNuevos,
    }
  })

  // Top prestaciones del período
  app.get('/top-prestaciones', async (request) => {
    request.requirePermiso('reporte:ver')
    const { desde, hasta } = parsearRango(request.query)
    const grouped = await prisma.turno.groupBy({
      by: ['prestacion_id'],
      where: {
        fecha_hora: { gte: desde, lte: hasta },
        estado: 'ATENDIDO',
        prestacion_id: { not: null },
      },
      _count: true,
      orderBy: { _count: { prestacion_id: 'desc' } },
      take: 10,
    })
    const ids = grouped.map((g) => g.prestacion_id!).filter(Boolean)
    const prestaciones = await prisma.prestacion.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, precio_particular: true, especialidad: { select: { nombre: true } } },
    })
    return grouped.map((g) => {
      const p = prestaciones.find((x) => x.id === g.prestacion_id)
      return {
        prestacion_id: g.prestacion_id,
        prestacion_nombre: p?.nombre,
        especialidad: p?.especialidad?.nombre ?? null,
        cantidad: g._count,
        precio_particular: p ? Number(p.precio_particular) : null,
      }
    })
  })

  // Productividad por profesional
  app.get('/productividad-profesional', async (request) => {
    request.requirePermiso('reporte:ver')
    const { desde, hasta } = parsearRango(request.query)
    const grouped = await prisma.turno.groupBy({
      by: ['profesional_id', 'estado'],
      where: { fecha_hora: { gte: desde, lte: hasta } },
      _count: true,
    })
    const profIds = [...new Set(grouped.map((g) => g.profesional_id))]
    const profs = await prisma.perfilProfesional.findMany({
      where: { id: { in: profIds } },
      include: { usuario: { select: { nombre: true, apellido: true } }, especialidad: true },
    })
    return profs.map((p) => {
      const rows = grouped.filter((g) => g.profesional_id === p.id)
      const sum = (estado: string) => rows.find((r) => r.estado === estado)?._count ?? 0
      return {
        profesional_id: p.id,
        profesional: `${p.usuario.apellido}, ${p.usuario.nombre}`,
        especialidad: p.especialidad.nombre,
        atendidos: sum('ATENDIDO'),
        no_show: sum('AUSENTE'),
        cancelados: sum('CANCELADO'),
        confirmados: sum('CONFIRMADO'),
        total: rows.reduce((acc, r) => acc + r._count, 0),
      }
    })
  })

  // Facturación por cobertura
  app.get('/facturacion-cobertura', async (request) => {
    request.requirePermiso('reporte:ver')
    const { desde, hasta } = parsearRango(request.query)
    const pagos = await prisma.pago.findMany({
      where: { fecha: { gte: desde, lte: hasta } },
      select: { monto: true, cobertura_id: true, medio: true },
    })
    const porCobertura: Record<string, number> = {}
    const porMedio: Record<string, number> = {}
    pagos.forEach((p) => {
      const key = p.cobertura_id ?? 'PARTICULAR'
      porCobertura[key] = (porCobertura[key] ?? 0) + Number(p.monto)
      porMedio[p.medio] = (porMedio[p.medio] ?? 0) + Number(p.monto)
    })

    const coberturaIds = Object.keys(porCobertura).filter((k) => k !== 'PARTICULAR')
    const coberturas = coberturaIds.length
      ? await prisma.coberturaMedica.findMany({
          where: { id: { in: coberturaIds } },
          select: { id: true, nombre: true },
        })
      : []

    return {
      periodo: { desde, hasta },
      por_cobertura: Object.entries(porCobertura).map(([id, monto]) => ({
        cobertura_id: id === 'PARTICULAR' ? null : id,
        cobertura_nombre: id === 'PARTICULAR' ? 'Particular' : coberturas.find((c) => c.id === id)?.nombre,
        monto,
      })),
      por_medio: Object.entries(porMedio).map(([medio, monto]) => ({ medio, monto })),
    }
  })

  // Pacientes nuevos / recurrentes / inactivos
  app.get('/pacientes', async (request) => {
    request.requirePermiso('reporte:ver')
    const { desde, hasta } = parsearRango(request.query)
    const limiteInactivo = new Date(Date.now() - 180 * 24 * 3600 * 1000)
    const [nuevos, recurrentes, inactivos, total] = await Promise.all([
      prisma.paciente.count({ where: { created_at: { gte: desde, lte: hasta } } }),
      prisma.paciente.count({
        where: { turnos: { some: { fecha_hora: { gte: desde, lte: hasta } } }, created_at: { lt: desde } },
      }),
      prisma.paciente.count({
        where: {
          estado: 'ACTIVO',
          turnos: { every: { fecha_hora: { lt: limiteInactivo } } },
        },
      }),
      prisma.paciente.count({ where: { estado: 'ACTIVO' } }),
    ])
    return { periodo: { desde, hasta }, nuevos, recurrentes, inactivos, total_activos: total }
  })

  // Efectividad de recordatorios — por ventana (48h / 24h / 2h)
  // Para cada ventana compara tasa de asistencia (estado=ATENDIDO) entre turnos
  // con recordatorio enviado vs sin recordatorio.
  app.get('/efectividad-recordatorios', async (request) => {
    request.requirePermiso('reporte:ver')
    const { desde, hasta } = parsearRango(request.query)
    const rangoBase = { fecha_hora: { gte: desde, lte: hasta } }

    async function comparativa(flag: 'recordatorio_48h_enviado' | 'recordatorio_24h_enviado' | 'recordatorio_2h_enviado') {
      const [total_con, atend_con, total_sin, atend_sin] = await Promise.all([
        prisma.turno.count({ where: { ...rangoBase, [flag]: true } as any }),
        prisma.turno.count({ where: { ...rangoBase, [flag]: true, estado: 'ATENDIDO' } as any }),
        prisma.turno.count({ where: { ...rangoBase, [flag]: false } as any }),
        prisma.turno.count({ where: { ...rangoBase, [flag]: false, estado: 'ATENDIDO' } as any }),
      ])
      return {
        con: { total: total_con, atendidos: atend_con, tasa: total_con > 0 ? Math.round((atend_con / total_con) * 100) : 0 },
        sin: { total: total_sin, atendidos: atend_sin, tasa: total_sin > 0 ? Math.round((atend_sin / total_sin) * 100) : 0 },
      }
    }

    const [ventana_48h, ventana_24h, ventana_2h] = await Promise.all([
      comparativa('recordatorio_48h_enviado'),
      comparativa('recordatorio_24h_enviado'),
      comparativa('recordatorio_2h_enviado'),
    ])

    return { periodo: { desde, hasta }, ventana_48h, ventana_24h, ventana_2h }
  })
}
