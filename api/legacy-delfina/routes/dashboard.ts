import type { FastifyInstance } from 'fastify'

export async function dashboardRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  function rangoDia(fecha?: string) {
    const d = fecha ? new Date(fecha) : new Date()
    const inicio = new Date(d); inicio.setHours(0, 0, 0, 0)
    const fin    = new Date(d); fin.setHours(23, 59, 59, 999)
    return { inicio, fin }
  }

  function rangoDesde(dias: number) {
    const fin    = new Date(); fin.setHours(23, 59, 59, 999)
    const inicio = new Date(); inicio.setDate(inicio.getDate() - dias); inicio.setHours(0, 0, 0, 0)
    return { inicio, fin }
  }

  // GET /dashboard/general?periodo=hoy|semana|mes|anio
  app.get('/general', async (request) => {
    const q = request.query as any
    const periodo = q.periodo ?? 'mes'

    const hoy = new Date()

    // fin para ventas (siempre hasta hoy — no se puede facturar el futuro)
    const finVentas = new Date(hoy); finVentas.setHours(23, 59, 59, 999)

    // inicio / fin para el período de turnos (incluye días futuros del mes/año)
    let inicio: Date, finTurnos: Date

    inicio    = new Date(hoy); inicio.setHours(0, 0, 0, 0)
    finTurnos = new Date(hoy); finTurnos.setHours(23, 59, 59, 999)

    if (periodo === 'semana') {
      inicio.setDate(inicio.getDate() - 6)
      // fin = hoy (ventana deslizante)
    } else if (periodo === 'mes') {
      inicio.setDate(1)
      // fin = último día del mes corriente
      finTurnos = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (periodo === 'anio') {
      inicio.setMonth(0, 1)
      // fin = 31 de diciembre del año corriente
      finTurnos = new Date(hoy.getFullYear(), 11, 31, 23, 59, 59, 999)
    }
    // hoy: inicio y finTurnos ya configurados como hoy

    // fin compartido para ventas = el menor entre finTurnos y hoy
    const fin = finVentas

    const diasPeriodo = Math.max(1, Math.ceil((fin.getTime() - inicio.getTime()) / 86400000))
    const inicioAnterior = new Date(inicio); inicioAnterior.setDate(inicioAnterior.getDate() - diasPeriodo)
    const finAnterior    = new Date(inicio); finAnterior.setMilliseconds(-1)

    const [
      ventas, ventasAnt,
      turnos, turnosAnt,
      clientesNuevos, clientesAnt,
      stockCritico,
      topServicios,
      mediosPago,
      turnosProximos,
      serieFacturacion,
    ] = await Promise.all([
      prisma.venta.findMany({ where: { createdAt: { gte: inicio, lte: fin }, estado: { in: ['PAGADA', 'PAGO_PARCIAL'] } } }),
      prisma.venta.findMany({ where: { createdAt: { gte: inicioAnterior, lte: finAnterior }, estado: { in: ['PAGADA', 'PAGO_PARCIAL'] } } }),
      prisma.turno.findMany({ where: { fecha: { gte: inicio, lte: finTurnos } }, include: { cliente: { select: { nombre: true, apellido: true } }, servicio: { select: { nombre: true } }, profesional: { select: { nombre: true, apellido: true, color: true } } } }),
      prisma.turno.findMany({ where: { fecha: { gte: inicioAnterior, lte: finAnterior }, estado: 'COMPLETADO' } }),
      prisma.cliente.count({ where: { createdAt: { gte: inicio, lte: fin }, deletedAt: null } }),
      prisma.cliente.count({ where: { createdAt: { gte: inicioAnterior, lte: finAnterior }, deletedAt: null } }),
      prisma.producto.findMany({ where: { activo: true, deletedAt: null }, select: { id: true, nombre: true, sku: true, stock_actual: true, stock_minimo: true, categoria: true } }),
      prisma.turno.findMany({
        where: { fecha: { gte: inicio, lte: finTurnos }, estado: 'COMPLETADO' },
        include: { servicio: { select: { nombre: true, categoria: true } } },
      }),
      prisma.venta.findMany({ where: { createdAt: { gte: inicio, lte: fin }, estado: { in: ['PAGADA', 'PAGO_PARCIAL'] } }, select: { medio_pago: true, total: true } }),
      prisma.turno.findMany({
        where: { fecha: { gte: new Date(), lte: new Date(Date.now() + 7 * 86400000) }, estado: { in: ['PENDIENTE', 'CONFIRMADO'] } },
        include: { cliente: { select: { nombre: true, apellido: true, telefono: true } }, servicio: { select: { nombre: true } }, profesional: { select: { nombre: true, apellido: true, color: true } } },
        orderBy: { fecha: 'asc' },
        take: 10,
      }),
      prisma.venta.findMany({ where: { createdAt: { gte: inicio, lte: fin }, estado: { in: ['PAGADA', 'PAGO_PARCIAL'] } }, select: { createdAt: true, total: true }, orderBy: { createdAt: 'asc' } }),
    ])

    const delta = (a: number, b: number) => b === 0 ? (a > 0 ? 100 : 0) : Math.round(((a - b) / b) * 100)

    const facturacion      = ventas.reduce((s, v) => s + Number(v.total), 0)
    const facturacionAnt   = ventasAnt.reduce((s, v) => s + Number(v.total), 0)
    const ticket           = ventas.length ? facturacion / ventas.length : 0
    const ticketAnt        = ventasAnt.length ? facturacionAnt / ventasAnt.length : 0

    const turnosPendientes        = turnos.filter(t => t.estado === 'PENDIENTE').length
    const turnosPendientePagoMp   = turnos.filter(t => t.estado === 'PENDIENTE_PAGO_MP').length
    const turnosConfirmados       = turnos.filter(t => t.estado === 'CONFIRMADO').length
    const turnosEnCurso           = turnos.filter(t => t.estado === 'EN_CURSO').length
    const turnosPendFacturar      = turnos.filter(t => t.estado === 'PENDIENTE_FACTURAR').length
    const turnosCompletados       = turnos.filter(t => t.estado === 'COMPLETADO').length
    const turnosCancelados        = turnos.filter(t => t.estado === 'CANCELADO').length
    const turnosNoShow            = turnos.filter(t => t.estado === 'NO_SHOW').length

    // Top servicios
    const svcMap: Record<string, { nombre: string; categoria: string; cantidad: number }> = {}
    for (const t of topServicios) {
      const k = t.servicio_id
      if (!svcMap[k]) svcMap[k] = { nombre: t.servicio.nombre, categoria: t.servicio.categoria, cantidad: 0 }
      svcMap[k].cantidad++
    }
    const topSvcs = Object.values(svcMap).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5)

    // Medios de pago
    const mpMap: Record<string, { cantidad: number; total: number }> = {}
    for (const v of mediosPago) {
      if (!mpMap[v.medio_pago]) mpMap[v.medio_pago] = { cantidad: 0, total: 0 }
      mpMap[v.medio_pago].cantidad++
      mpMap[v.medio_pago].total += Number(v.total)
    }
    const facturacionTotal = facturacion || 1
    const mediosPagoArr = Object.entries(mpMap).map(([medio, s]) => ({ medio, cantidad: s.cantidad, total: s.total, pct: Math.round((s.total / facturacionTotal) * 100) })).sort((a, b) => b.total - a.total)

    // Stock crítico
    const criticos = stockCritico.filter(p => p.stock_actual <= p.stock_minimo)

    // Serie facturación por día
    const serie: Record<string, number> = {}
    for (const v of serieFacturacion) {
      const dia = v.createdAt.toISOString().split('T')[0]
      serie[dia] = (serie[dia] || 0) + Number(v.total)
    }
    const serieArr = Object.entries(serie).map(([fecha, total]) => ({ fecha, total }))

    return {
      periodo,
      kpis: {
        facturacion:     { total: facturacion,           delta: delta(facturacion, facturacionAnt) },
        ventas:          { total: ventas.length,          delta: delta(ventas.length, ventasAnt.length) },
        ticket_promedio: { total: Math.round(ticket),    delta: delta(ticket, ticketAnt) },
        turnos:          { total: turnos.length,          delta: delta(turnos.length, turnosAnt.length) },
        clientes_nuevos: { total: clientesNuevos,         delta: delta(clientesNuevos, clientesAnt) },
        stock_critico:   { total: criticos.length },
      },
      turnos: {
        pendientes:           turnosPendientes,
        pendientes_pago_mp:   turnosPendientePagoMp,
        confirmados:          turnosConfirmados,
        en_curso:             turnosEnCurso,
        pendientes_facturar:  turnosPendFacturar,
        completados:          turnosCompletados,
        cancelados:           turnosCancelados,
        no_show:              turnosNoShow,
        total:                turnos.length,
      },
      top_servicios: topSvcs,
      medios_pago:   mediosPagoArr,
      stock_critico: criticos,
      proximas_reservas: turnosProximos.map(t => ({
        id: t.id, fecha: t.fecha, estado: t.estado,
        cliente:     `${t.cliente.nombre} ${t.cliente.apellido ?? ''}`.trim(),
        telefono:    t.cliente.telefono,
        servicio:    t.servicio.nombre,
        profesional: `${t.profesional.nombre} ${t.profesional.apellido ?? ''}`.trim(),
        color:       t.profesional.color,
      })),
      serie_facturacion: serieArr,
    }
  })

  // GET /dashboard/profesionales?periodo=mes&profesional_id=xxx
  app.get('/profesionales', async (request) => {
    const q = request.query as any
    const periodo = q.periodo ?? 'mes'

    let inicio: Date, fin: Date
    fin = new Date(); fin.setHours(23, 59, 59, 999)
    inicio = new Date(); inicio.setHours(0, 0, 0, 0)
    if (periodo === 'semana') inicio.setDate(inicio.getDate() - 6)
    else if (periodo === 'mes') inicio.setDate(1)
    else if (periodo === 'anio') inicio.setMonth(0, 1)

    const whereVenta: any = {
      createdAt: { gte: inicio, lte: fin },
      estado: { in: ['PAGADA', 'PAGO_PARCIAL'] },
      profesional_id: { not: null },
    }
    if (q.profesional_id) whereVenta.profesional_id = q.profesional_id

    const ventas = await prisma.venta.findMany({
      where: whereVenta,
      include: {
        profesional: { select: { id: true, nombre: true, apellido: true, color: true, tipo_comision: true, porcentaje_comision: true } },
        items: { select: { tipo: true, nombre: true, subtotal: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    if (ventas.length === 0) {
      return { data: [], periodo, empty: true }
    }

    const profsMap: Record<string, any> = {}
    for (const v of ventas) {
      if (!v.profesional_id || !v.profesional) continue
      const k = v.profesional_id
      if (!profsMap[k]) {
        profsMap[k] = {
          id: v.profesional.id, nombre: v.profesional.nombre, apellido: v.profesional.apellido,
          color: v.profesional.color, cantidad: 0, facturacion: 0, base_comisionable: 0, comision: 0,
          tipo_comision: v.profesional.tipo_comision ?? 'NINGUNA',
          pct_comision: Number(v.profesional.porcentaje_comision ?? 0),
          servicios: {} as Record<string, number>,
          por_dia: {} as Record<string, number>,
        }
      }
      profsMap[k].cantidad++

      // Calcular base comisionable según tipo
      const baseServicios = v.items.filter(i => i.tipo === 'SERVICIO').reduce((s, i) => s + Number(i.subtotal), 0)
      const baseProductos = v.items.filter(i => i.tipo === 'PRODUCTO').reduce((s, i) => s + Number(i.subtotal), 0)

      const tipoComision = v.profesional.tipo_comision ?? 'NINGUNA'
      const pctComision = Number(v.profesional.porcentaje_comision ?? 0) / 100

      let baseComisionable = 0
      if (tipoComision === 'SERVICIOS') baseComisionable = baseServicios
      else if (tipoComision === 'PRODUCTOS') baseComisionable = baseProductos

      profsMap[k].facturacion += Number(v.total)
      profsMap[k].base_comisionable += baseComisionable
      profsMap[k].comision += baseComisionable * pctComision
      profsMap[k].tipo_comision = tipoComision
      profsMap[k].pct_comision = Number(v.profesional.porcentaje_comision ?? 0)

      const dia = v.createdAt.toISOString().split('T')[0]
      profsMap[k].por_dia[dia] = (profsMap[k].por_dia[dia] || 0) + Number(v.total)
      for (const item of v.items.filter(i => i.tipo === 'SERVICIO')) {
        profsMap[k].servicios[item.nombre] = (profsMap[k].servicios[item.nombre] || 0) + 1
      }
    }

    const profs = Object.values(profsMap).map((p: any) => ({
      ...p,
      comision: Math.round(p.comision),
      facturacion: Math.round(p.facturacion),
      base_comisionable: Math.round(p.base_comisionable),
      top_servicio: Object.entries(p.servicios as Record<string, number>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
      serie_dia: Object.entries(p.por_dia as Record<string, number>).map(([fecha, total]) => ({ fecha, total })),
    })).sort((a: any, b: any) => b.facturacion - a.facturacion)

    return { data: profs, periodo }
  })

  // GET /dashboard/servicios?periodo=mes
  app.get('/servicios', async (request) => {
    const q = request.query as any
    const periodo = q.periodo ?? 'mes'

    let inicio: Date, fin: Date
    fin = new Date(); fin.setHours(23, 59, 59, 999)
    inicio = new Date(); inicio.setHours(0, 0, 0, 0)
    if (periodo === 'semana') inicio.setDate(inicio.getDate() - 6)
    else if (periodo === 'mes') inicio.setDate(1)
    else if (periodo === 'anio') inicio.setMonth(0, 1)

    const [itemsVenta, servicios] = await Promise.all([
      prisma.itemVenta.findMany({
        where: {
          tipo: 'SERVICIO',
          venta: { createdAt: { gte: inicio, lte: fin }, estado: { in: ['PAGADA', 'PAGO_PARCIAL'] } },
        },
        select: { referencia_id: true, nombre: true, cantidad: true, subtotal: true },
      }),
      prisma.servicio.findMany({ where: { activo: true, deletedAt: null }, select: { id: true, nombre: true, categoria: true, duracion_min: true, precio: true } }),
    ])

    const svcMap: Record<string, any> = {}
    for (const s of servicios) {
      svcMap[s.id] = { id: s.id, nombre: s.nombre, categoria: s.categoria, duracion_min: s.duracion_min, precio: Number(s.precio), cantidad: 0, ingresos: 0 }
    }

    // Agregar items por referencia_id; si no existe en catálogo activo, crear entrada dinámica
    for (const item of itemsVenta) {
      const k = item.referencia_id
      if (!svcMap[k]) {
        svcMap[k] = { id: k, nombre: item.nombre, categoria: '—', duracion_min: 0, precio: 0, cantidad: 0, ingresos: 0 }
      }
      svcMap[k].cantidad += item.cantidad
      svcMap[k].ingresos += Number(item.subtotal)
    }

    const total_ingresos = Object.values(svcMap).reduce((s: number, v: any) => s + v.ingresos, 0) || 1

    return {
      data: Object.values(svcMap)
        .map((s: any) => ({ ...s, ingresos: Math.round(s.ingresos), participacion: Math.round((s.ingresos / total_ingresos) * 100) }))
        .sort((a, b) => b.cantidad - a.cantidad),
      periodo,
    }
  })

  // GET /dashboard/turnos-hoy
  app.get('/turnos-hoy', async () => {
    const { inicio, fin } = rangoDia()
    const turnos = await prisma.turno.findMany({
      where: { fecha: { gte: inicio, lte: fin } },
      include: {
        cliente:     { select: { id: true, nombre: true, apellido: true, telefono: true } },
        servicio:    { select: { nombre: true, categoria: true, duracion_min: true } },
        profesional: { select: { nombre: true, apellido: true, color: true } },
      },
      orderBy: { fecha: 'asc' },
    })
    return { data: turnos, total: turnos.length, fecha: inicio.toISOString().split('T')[0] }
  })
}
