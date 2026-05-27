/**
 * Dashboard clínico ejecutivo.
 *  - KPIs del día con comparativos vs semana/mes anterior
 *  - Turnos del día con drill-down
 *  - Ocupación por profesional
 *  - Top prácticas
 *  - Cobros pendientes
 *  - Alertas operativas
 *  - Próximas videoconsultas
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

function rangoDia(d: Date) {
  const ini = new Date(d); ini.setHours(0, 0, 0, 0)
  const fin = new Date(d); fin.setHours(23, 59, 59, 999)
  return { ini, fin }
}

function rangoMes(d: Date) {
  const ini = new Date(d.getFullYear(), d.getMonth(), 1)
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { ini, fin }
}

function rangoSemana(d: Date) {
  const dia = d.getDay() === 0 ? 6 : d.getDay() - 1
  const lunes = new Date(d); lunes.setDate(d.getDate() - dia); lunes.setHours(0, 0, 0, 0)
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6); domingo.setHours(23, 59, 59, 999)
  return { ini: lunes, fin: domingo }
}

function pctDelta(actual: number, anterior: number): number {
  if (anterior === 0) return actual > 0 ? 100 : 0
  return Math.round(((actual - anterior) / anterior) * 100)
}

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    request.requireAuth()
    const ahora = new Date()
    const hoy = rangoDia(ahora)
    const semActual = rangoSemana(ahora)
    const semAnterior = rangoSemana(new Date(ahora.getTime() - 7 * 24 * 3600 * 1000))
    const mesActual = rangoMes(ahora)
    const mesAnterior = rangoMes(new Date(ahora.getFullYear(), ahora.getMonth() - 1, 15))

    const [
      turnosHoy,
      atendHoy,
      pendHoy,
      confHoy,
      cancHoy,
      ausHoy,
      ingHoy,
      ingMes,
      ingMesAnt,
      pacNuevosMes,
      pacNuevosMesAnt,
      turnosSemActual,
      turnosSemAnt,
      ausentesMes,
      atendidosMes,
      facturacionPend,
      ocupacionProf,
      topPracticas,
      proxVideoconsultas,
    ] = await Promise.all([
      // Turnos del día con detalle
      prisma.turno.findMany({
        where: { fecha_hora: { gte: hoy.ini, lte: hoy.fin } },
        include: {
          paciente: { select: { id: true, nombre: true, apellido: true, dni: true, segmento: true } },
          profesional: { include: { usuario: { select: { nombre: true, apellido: true } }, especialidad: true } },
          prestacion: { select: { nombre: true } },
          sede: { select: { nombre: true } },
          consultorio: { select: { nombre: true } },
        },
        orderBy: { fecha_hora: 'asc' },
      }),
      prisma.turno.count({ where: { fecha_hora: { gte: hoy.ini, lte: hoy.fin }, estado: 'ATENDIDO' } }),
      prisma.turno.count({ where: { fecha_hora: { gte: hoy.ini, lte: hoy.fin }, estado: { in: ['PENDIENTE', 'PENDIENTE_PAGO_MP', 'PENDIENTE_VALIDACION_MANUAL'] } } }),
      prisma.turno.count({ where: { fecha_hora: { gte: hoy.ini, lte: hoy.fin }, estado: 'CONFIRMADO' } }),
      prisma.turno.count({ where: { fecha_hora: { gte: hoy.ini, lte: hoy.fin }, estado: 'CANCELADO' } }),
      prisma.turno.count({ where: { fecha_hora: { gte: hoy.ini, lte: hoy.fin }, estado: 'AUSENTE' } }),
      prisma.pago.aggregate({ where: { fecha: { gte: hoy.ini, lte: hoy.fin } }, _sum: { monto: true } }),
      prisma.pago.aggregate({ where: { fecha: { gte: mesActual.ini, lte: mesActual.fin } }, _sum: { monto: true } }),
      prisma.pago.aggregate({ where: { fecha: { gte: mesAnterior.ini, lte: mesAnterior.fin } }, _sum: { monto: true } }),
      prisma.paciente.count({ where: { created_at: { gte: mesActual.ini } } }),
      prisma.paciente.count({ where: { created_at: { gte: mesAnterior.ini, lte: mesAnterior.fin } } }),
      prisma.turno.count({ where: { fecha_hora: { gte: semActual.ini, lte: semActual.fin } } }),
      prisma.turno.count({ where: { fecha_hora: { gte: semAnterior.ini, lte: semAnterior.fin } } }),
      prisma.turno.count({ where: { fecha_hora: { gte: mesActual.ini, lte: mesActual.fin }, estado: 'AUSENTE' } }),
      prisma.turno.count({ where: { fecha_hora: { gte: mesActual.ini, lte: mesActual.fin }, estado: 'ATENDIDO' } }),
      prisma.comprobante.aggregate({ where: { estado: { in: ['EMITIDO', 'PAGO_PARCIAL'] } }, _sum: { saldo: true } }),

      // Ocupación por profesional (turnos semana actual / horarios semana actual)
      prisma.turno.groupBy({
        by: ['profesional_id'],
        where: { fecha_hora: { gte: semActual.ini, lte: semActual.fin }, estado: { notIn: ['CANCELADO', 'AUSENTE', 'VENCIDO'] } },
        _count: true,
        orderBy: { _count: { profesional_id: 'desc' } },
        take: 10,
      }),

      // Top prácticas del mes
      prisma.turno.groupBy({
        by: ['prestacion_id'],
        where: { fecha_hora: { gte: mesActual.ini, lte: mesActual.fin }, estado: 'ATENDIDO', prestacion_id: { not: null } },
        _count: true,
        orderBy: { _count: { prestacion_id: 'desc' } },
        take: 5,
      }),

      // Próximas videoconsultas (siguientes 24 hs)
      prisma.turno.findMany({
        where: {
          modalidad: 'VIRTUAL',
          fecha_hora: { gte: ahora, lte: new Date(ahora.getTime() + 24 * 3600 * 1000) },
          estado: { in: ['CONFIRMADO', 'PENDIENTE'] },
        },
        include: {
          paciente: { select: { nombre: true, apellido: true } },
          profesional: { include: { usuario: { select: { nombre: true, apellido: true } } } },
        },
        orderBy: { fecha_hora: 'asc' },
        take: 10,
      }),
    ])

    const profIds = ocupacionProf.map((o) => o.profesional_id)
    const profsData = await prisma.perfilProfesional.findMany({
      where: { id: { in: profIds } },
      include: { usuario: { select: { nombre: true, apellido: true } }, especialidad: { select: { nombre: true } } },
    })

    const presIds = topPracticas.map((p) => p.prestacion_id!).filter(Boolean)
    const presData = presIds.length > 0
      ? await prisma.prestacion.findMany({ where: { id: { in: presIds } }, select: { id: true, nombre: true } })
      : []

    // Alertas operativas
    const [stockCritico, comprobantesPendientes, vencimientos] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint FROM "Insumo"
        WHERE "deleted_at" IS NULL AND "activo" = true AND "stock_actual" <= "stock_minimo"
      `,
      prisma.comprobanteTransferencia.count({ where: { estado: 'PENDIENTE_REVISION' } }),
      prisma.loteInsumo.count({
        where: { vencimiento: { not: null, lte: new Date(Date.now() + 30 * 24 * 3600 * 1000) }, cantidad: { gt: 0 } },
      }),
    ])

    const ingHoyNum = Number(ingHoy._sum.monto ?? 0)
    const ingMesNum = Number(ingMes._sum.monto ?? 0)
    const ingMesAntNum = Number(ingMesAnt._sum.monto ?? 0)
    const ausentismoPct = atendidosMes + ausentesMes > 0 ? Math.round((ausentesMes / (atendidosMes + ausentesMes)) * 100) : 0

    return {
      turnos_hoy: turnosHoy,
      kpis: {
        atendidos_hoy: atendHoy,
        pendientes_hoy: pendHoy,
        confirmados_hoy: confHoy,
        cancelados_hoy: cancHoy,
        ausentes_hoy: ausHoy,
        total_hoy: turnosHoy.length,
        ingresos_hoy: ingHoyNum,
        ingresos_mes: ingMesNum,
        ingresos_mes_delta_pct: pctDelta(ingMesNum, ingMesAntNum),
        pacientes_nuevos_mes: pacNuevosMes,
        pacientes_nuevos_mes_delta_pct: pctDelta(pacNuevosMes, pacNuevosMesAnt),
        turnos_semana: turnosSemActual,
        turnos_semana_delta_pct: pctDelta(turnosSemActual, turnosSemAnt),
        tasa_ausentismo_mes: ausentismoPct,
        facturacion_pendiente: Number(facturacionPend._sum.saldo ?? 0),
      },
      ocupacion_profesional: ocupacionProf.map((o) => {
        const p = profsData.find((x) => x.id === o.profesional_id)
        return {
          profesional_id: o.profesional_id,
          profesional: p ? `${p.usuario.apellido}, ${p.usuario.nombre}` : 'Desconocido',
          especialidad: p?.especialidad.nombre ?? null,
          turnos_semana: o._count,
        }
      }),
      top_practicas: topPracticas.map((tp) => ({
        prestacion_id: tp.prestacion_id,
        prestacion: presData.find((p) => p.id === tp.prestacion_id)?.nombre ?? 'Desconocida',
        cantidad: tp._count,
      })),
      proximas_videoconsultas: proxVideoconsultas.map((v) => ({
        turno_id: v.id,
        fecha_hora: v.fecha_hora,
        paciente: `${v.paciente.apellido}, ${v.paciente.nombre}`,
        profesional: `${v.profesional.usuario.apellido}, ${v.profesional.usuario.nombre}`,
        url: v.videoconsulta_url,
        estado: v.videoconsulta_estado,
      })),
      alertas_operativas: {
        stock_critico: Number(stockCritico[0]?.count ?? 0),
        comprobantes_pendientes_revision: comprobantesPendientes,
        insumos_proximos_a_vencer: vencimientos,
      },
    }
  })
}
