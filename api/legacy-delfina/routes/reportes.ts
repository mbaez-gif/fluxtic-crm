import type { FastifyInstance } from 'fastify'

export async function reportesRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  function rangoDeFechas(periodo: string): { inicio: Date, fin: Date } {
    const fin = new Date()
    fin.setHours(23, 59, 59, 999)
    const inicio = new Date()
    inicio.setHours(0, 0, 0, 0)

    switch (periodo) {
      case 'hoy': break
      case 'semana': inicio.setDate(inicio.getDate() - 7); break
      case 'mes': inicio.setDate(1); break
      case '3meses': inicio.setMonth(inicio.getMonth() - 3); break
      case 'anio': inicio.setMonth(0, 1); break
      default: inicio.setDate(inicio.getDate() - 30)
    }
    return { inicio, fin }
  }

  app.get('/resumen', async (request) => {
    const q = request.query as any
    const { inicio, fin } = rangoDeFechas(q.periodo ?? 'mes')

    const ventas = await prisma.venta.findMany({ where: { createdAt: { gte: inicio, lte: fin } } })
    const diasPeriodo = Math.ceil((fin.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24))
    const inicioAnterior = new Date(inicio)
    inicioAnterior.setDate(inicioAnterior.getDate() - diasPeriodo)
    const finAnterior = new Date(inicio)
    finAnterior.setMilliseconds(finAnterior.getMilliseconds() - 1)

    const ventasAnterior = await prisma.venta.findMany({ where: { createdAt: { gte: inicioAnterior, lte: finAnterior } } })
    const turnos = await prisma.turno.findMany({ where: { fecha: { gte: inicio, lte: fin }, estado: { in: ['COMPLETADO', 'CONFIRMADO', 'EN_CURSO'] } } })
    const turnosAnterior = await prisma.turno.findMany({ where: { fecha: { gte: inicioAnterior, lte: finAnterior }, estado: 'COMPLETADO' } })
    const clientesNuevos = await prisma.cliente.count({ where: { createdAt: { gte: inicio, lte: fin } } })
    const clientesAnterior = await prisma.cliente.count({ where: { createdAt: { gte: inicioAnterior, lte: finAnterior } } })

    const facturacion = ventas.reduce((acc, v) => acc + Number(v.total), 0)
    const facturacionAnterior = ventasAnterior.reduce((acc, v) => acc + Number(v.total), 0)
    const ticketPromedio = ventas.length > 0 ? facturacion / ventas.length : 0
    const ticketAnterior = ventasAnterior.length > 0 ? facturacionAnterior / ventasAnterior.length : 0

    const deltaPct = (a: number, b: number) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100)

    return {
      periodo: q.periodo ?? 'mes',
      facturacion: { total: facturacion, delta: deltaPct(facturacion, facturacionAnterior), anterior: facturacionAnterior },
      turnos: { total: turnos.length, delta: deltaPct(turnos.length, turnosAnterior.length), anterior: turnosAnterior.length },
      clientes_nuevos: { total: clientesNuevos, delta: deltaPct(clientesNuevos, clientesAnterior), anterior: clientesAnterior },
      ticket_promedio: { total: Math.round(ticketPromedio), delta: deltaPct(ticketPromedio, ticketAnterior), anterior: Math.round(ticketAnterior) }
    }
  })

  app.get('/top-servicios', async (request) => {
    const q = request.query as any
    const { inicio, fin } = rangoDeFechas(q.periodo ?? 'mes')
    const turnos = await prisma.turno.findMany({
      where: { fecha: { gte: inicio, lte: fin }, estado: 'COMPLETADO' },
      include: { servicio: true }
    })

    const stats: Record<string, { id: string, nombre: string, cantidad: number, facturacion: number }> = {}
    for (const t of turnos) {
      const k = t.servicio.id
      if (!stats[k]) stats[k] = { id: t.servicio.id, nombre: t.servicio.nombre, cantidad: 0, facturacion: 0 }
      stats[k].cantidad++
      stats[k].facturacion += Number(t.precio)
    }
    return { data: Object.values(stats).sort((a, b) => b.facturacion - a.facturacion) }
  })

  app.get('/comisiones', async (request) => {
    const q = request.query as any
    const { inicio, fin } = rangoDeFechas(q.periodo ?? 'mes')
    const pct = Number(q.porcentaje ?? 15) / 100

    const turnos = await prisma.turno.findMany({
      where: { fecha: { gte: inicio, lte: fin }, estado: 'COMPLETADO' },
      include: { profesional: true }
    })

    const stats: Record<string, any> = {}
    for (const t of turnos) {
      const k = t.profesional_id
      if (!stats[k]) stats[k] = {
        id: t.profesional.id, nombre: t.profesional.nombre, apellido: t.profesional.apellido ?? '',
        cantidad: 0, facturacion: 0, comision: 0
      }
      stats[k].cantidad++
      stats[k].facturacion += Number(t.precio)
      stats[k].comision += Number(t.precio) * pct
    }
    return { data: Object.values(stats).sort((a: any, b: any) => b.facturacion - a.facturacion), porcentaje: pct * 100 }
  })

  app.get('/conversion-canal', async (request) => {
    const q = request.query as any
    const { inicio, fin } = rangoDeFechas(q.periodo ?? 'mes')
    const clientes = await prisma.cliente.findMany({ where: { createdAt: { gte: inicio, lte: fin } } })

    const stats: Record<string, number> = {}
    for (const c of clientes) stats[c.origen] = (stats[c.origen] || 0) + 1

    const total = clientes.length
    const data = Object.entries(stats).map(([origen, cantidad]) => ({
      origen, cantidad,
      porcentaje: total > 0 ? Math.round((cantidad / total) * 100) : 0,
    })).sort((a, b) => b.cantidad - a.cantidad)
    return { data, total_clientes: total }
  })

  app.get('/serie-facturacion', async (request) => {
    const q = request.query as any
    const { inicio, fin } = rangoDeFechas(q.periodo ?? 'mes')
    const ventas = await prisma.venta.findMany({ where: { createdAt: { gte: inicio, lte: fin } }, orderBy: { createdAt: 'asc' } })

    const porDia: Record<string, number> = {}
    for (const v of ventas) {
      const dia = v.createdAt.toISOString().split('T')[0]
      porDia[dia] = (porDia[dia] || 0) + Number(v.total)
    }
    return { data: Object.entries(porDia).map(([fecha, total]) => ({ fecha, total })) }
  })

  app.get('/medios-pago', async (request) => {
    const q = request.query as any
    const { inicio, fin } = rangoDeFechas(q.periodo ?? 'mes')
    const ventas = await prisma.venta.findMany({ where: { createdAt: { gte: inicio, lte: fin } } })

    const stats: Record<string, { cantidad: number, total: number }> = {}
    for (const v of ventas) {
      if (!stats[v.medio_pago]) stats[v.medio_pago] = { cantidad: 0, total: 0 }
      stats[v.medio_pago].cantidad++
      stats[v.medio_pago].total += Number(v.total)
    }
    const totalGeneral = ventas.reduce((acc, v) => acc + Number(v.total), 0)
    const data = Object.entries(stats).map(([medio, s]) => ({
      medio, cantidad: s.cantidad, total: s.total,
      porcentaje: totalGeneral > 0 ? Math.round((s.total / totalGeneral) * 100) : 0,
    })).sort((a, b) => b.total - a.total)
    return { data, total_general: totalGeneral }
  })
}
