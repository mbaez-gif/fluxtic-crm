/**
 * Dashboard clinico: KPIs del dia para admin/recepcion.
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requireAuth()
    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0)
    const hoy24 = new Date(hoy0.getTime() + 24 * 3600 * 1000)

    const [
      turnosHoy,
      atendidosHoy,
      pendientesHoy,
      noShowHoy,
      ingresosHoy,
      facturacionPendiente,
      pacientesActivos,
      profesionalesActivos,
      stockCritico,
    ] = await Promise.all([
      prisma.turno.findMany({
        where: { fecha_hora: { gte: hoy0, lt: hoy24 } },
        include: {
          paciente: { select: { id: true, nombre: true, apellido: true, dni: true } },
          profesional: { include: { usuario: { select: { nombre: true, apellido: true } }, especialidad: true } },
          sede: { select: { nombre: true } },
          consultorio: { select: { nombre: true } },
          prestacion: { select: { nombre: true } },
        },
        orderBy: { fecha_hora: 'asc' },
      }),
      prisma.turno.count({ where: { fecha_hora: { gte: hoy0, lt: hoy24 }, estado: 'ATENDIDO' } }),
      prisma.turno.count({ where: { fecha_hora: { gte: hoy0, lt: hoy24 }, estado: { in: ['PENDIENTE', 'CONFIRMADO', 'EN_SALA_ESPERA'] } } }),
      prisma.turno.count({ where: { fecha_hora: { gte: hoy0, lt: hoy24 }, estado: 'AUSENTE' } }),
      prisma.pago.aggregate({
        where: { fecha: { gte: hoy0, lt: hoy24 } },
        _sum: { monto: true },
      }),
      prisma.comprobante.aggregate({
        where: { estado: { in: ['EMITIDO', 'PAGO_PARCIAL'] } },
        _sum: { saldo: true },
      }),
      prisma.paciente.count({ where: { estado: 'ACTIVO' } }),
      prisma.perfilProfesional.count({ where: { usuario: { activo: true } } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint FROM "Insumo"
        WHERE "deleted_at" IS NULL AND "activo" = true AND "stock_actual" <= "stock_minimo"
      `,
    ])

    return {
      turnos_hoy: turnosHoy,
      kpis: {
        atendidos_hoy: atendidosHoy,
        pendientes_hoy: pendientesHoy,
        no_show_hoy: noShowHoy,
        ingresos_hoy: Number(ingresosHoy._sum.monto ?? 0),
        facturacion_pendiente: Number(facturacionPendiente._sum.saldo ?? 0),
        pacientes_activos: pacientesActivos,
        profesionales_activos: profesionalesActivos,
        stock_critico: Number(stockCritico[0]?.count ?? 0),
      },
    }
  })
}
