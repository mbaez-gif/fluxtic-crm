import type { FastifyInstance } from 'fastify'
import { TipoMovimiento } from '@prisma/client'
import { generarPdfVenta, subirPdfBackground } from './pdf'

interface ItemVentaBody {
  tipo: 'SERVICIO' | 'PRODUCTO'
  id: string
  nombre: string
  cantidad: number
  precio_unitario: number
  descuento?: number
}

interface VentaBody {
  cliente_id?: string
  profesional_id?: string
  turno_id?: string
  origen?: string
  items: ItemVentaBody[]
  medio_pago: 'EFECTIVO' | 'TRANSFERENCIA' | 'DEBITO' | 'CREDITO' | 'MERCADOPAGO'
  descuento?: number          // monto $ de descuento global
  descuento_pct?: number      // % de descuento global
  sena_aplicada?: number
  notas?: string
}

export async function ventasRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  // GET /ventas — historial con filtros
  app.get('/', async (request) => {
    const q = request.query as any
    const page  = Math.max(1, parseInt(q.page ?? '1'))
    const limit = Math.min(100, parseInt(q.limit ?? '50'))
    const skip  = (page - 1) * limit

    const where: any = {}
    if (q.estado) where.estado = q.estado
    if (q.origen) where.origen = q.origen
    if (q.cliente_id) where.cliente_id = q.cliente_id
    if (q.profesional_id) where.profesional_id = q.profesional_id
    if (q.medio_pago) where.medio_pago = q.medio_pago
    if (q.desde || q.hasta) {
      where.createdAt = {}
      if (q.desde) { const d = new Date(q.desde); d.setHours(0,0,0,0); where.createdAt.gte = d }
      if (q.hasta) { const d = new Date(q.hasta); d.setHours(23,59,59,999); where.createdAt.lte = d }
    }
    if (q.fecha) {
      const d = new Date(q.fecha)
      const inicio = new Date(d); inicio.setHours(0,0,0,0)
      const fin    = new Date(d); fin.setHours(23,59,59,999)
      where.createdAt = { gte: inicio, lte: fin }
    }

    const [total, ventas] = await Promise.all([
      prisma.venta.count({ where }),
      prisma.venta.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          cliente:     { select: { id: true, nombre: true, apellido: true, telefono: true } },
          profesional: { select: { id: true, nombre: true, apellido: true, color: true } },
          items:       true,
        },
      }),
    ])

    return {
      data: ventas.map(v => ({
        ...v,
        total: Number(v.total), subtotal: Number(v.subtotal),
        descuento: Number(v.descuento), descuento_pct: Number(v.descuento_pct),
        sena_aplicada: v.sena_aplicada ? Number(v.sena_aplicada) : null,
        items: v.items.map(i => ({ ...i, precio_unitario: Number(i.precio_unitario), subtotal: Number(i.subtotal), descuento: Number(i.descuento) })),
      })),
      total, page, limit,
    }
  })

  // GET /ventas/:id — detalle
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as any
    const venta = await prisma.venta.findUnique({
      where: { id },
      include: {
        cliente:     { select: { id: true, nombre: true, apellido: true, telefono: true, email: true } },
        profesional: { select: { id: true, nombre: true, apellido: true, color: true } },
        items:       true,
      },
    })
    if (!venta) return reply.notFound('Venta no encontrada')
    return {
      ...venta,
      total: Number(venta.total), subtotal: Number(venta.subtotal),
      descuento: Number(venta.descuento), descuento_pct: Number(venta.descuento_pct),
      sena_aplicada: venta.sena_aplicada ? Number(venta.sena_aplicada) : null,
      items: venta.items.map(i => ({ ...i, precio_unitario: Number(i.precio_unitario), subtotal: Number(i.subtotal), descuento: Number(i.descuento) })),
    }
  })

  // POST /ventas — registrar venta
  app.post('/', async (request, reply) => {
    const body = request.body as VentaBody

    if (!body.items?.length) return reply.badRequest('La venta debe tener al menos un item')
    if (!body.medio_pago)    return reply.badRequest('Falta medio_pago')

    // Validar que el turno no haya sido facturado ya
    if (body.turno_id) {
      const ventaExistente = await prisma.venta.findFirst({
        where: { turno_id: body.turno_id, estado: { not: 'ANULADA' } },
        select: { id: true, numero_comprobante: true },
      })
      if (ventaExistente) {
        return reply.status(409).send({
          error: 'El turno ya fue facturado',
          venta_id: ventaExistente.id,
          numero_comprobante: ventaExistente.numero_comprobante,
        })
      }
    }

    const subtotalItems = body.items.reduce((acc, i) => acc + (i.precio_unitario * i.cantidad) - (i.descuento ?? 0), 0)
    const descuentoGlobal   = Number(body.descuento ?? 0)
    const descuentoPct      = Number(body.descuento_pct ?? 0)
    const descuentoFinal    = descuentoGlobal > 0 ? descuentoGlobal : (subtotalItems * descuentoPct / 100)
    const senaAplicada      = Number(body.sena_aplicada ?? 0)
    const total             = Math.max(0, subtotalItems - descuentoFinal - senaAplicada)

    try {
      const venta = await prisma.$transaction(async (tx) => {
        // Número de comprobante: MAX() ignora NULLs correctamente.
        // findFirst DESC en Postgres pone NULLs primero, por eso se usa MAX.
        const result = await tx.$queryRaw<[{ max: number | null }]>`
          SELECT MAX(numero_comprobante) AS max FROM ventas
        `
        const numero_comprobante = (result[0].max ?? 0) + 1

        const v = await tx.venta.create({
          data: {
            numero_comprobante,
            cliente_id:     body.cliente_id     ?? null,
            profesional_id: body.profesional_id ?? null,
            turno_id:       body.turno_id       ?? null,
            origen:         (body.origen as any) ?? 'LOCAL',
            estado:         'PAGADA',
            medio_pago:     body.medio_pago,
            subtotal:       subtotalItems,
            descuento:      descuentoFinal,
            descuento_pct:  descuentoPct,
            total,
            sena_aplicada:  senaAplicada > 0 ? senaAplicada : null,
            notas:          body.notas ?? null,
            items: {
              create: body.items.map(i => ({
                tipo:           i.tipo,
                referencia_id:  i.id,
                nombre:         i.nombre,
                cantidad:       i.cantidad,
                precio_unitario: i.precio_unitario,
                descuento:      i.descuento ?? 0,
                subtotal:       i.precio_unitario * i.cantidad - (i.descuento ?? 0),
              })),
            },
          },
          include: {
            cliente:     { select: { id: true, nombre: true, apellido: true } },
            profesional: { select: { id: true, nombre: true, apellido: true } },
            items:       true,
          },
        })

        // Descontar stock de productos
        for (const item of body.items.filter(i => i.tipo === 'PRODUCTO')) {
          const prod = await tx.producto.findUnique({ where: { id: item.id } })
          if (prod) {
            const nuevo = prod.stock_actual - item.cantidad
            await tx.producto.update({ where: { id: item.id }, data: { stock_actual: Math.max(0, nuevo), updatedAt: new Date() } })
            await tx.movimientoStock.create({
              data: {
                producto_id:     item.id,
                tipo:            TipoMovimiento.VENTA_LOCAL,
                cantidad:        -item.cantidad,
                stock_resultante: Math.max(0, nuevo),
                referencia_id:   v.id,
                notas:           `Venta #${String(v.numero_comprobante).padStart(6, '0')}`,
              },
            })
          }
        }

        // Actualizar stats del cliente
        if (body.cliente_id) {
          await tx.cliente.update({
            where: { id: body.cliente_id },
            data: { total_compras: { increment: total }, ultima_compra: new Date() },
          })
        }

        return v
      })

      // Marcar turno como COMPLETADO si viene de un turno
      if (body.turno_id) {
        prisma.turno.update({ where: { id: body.turno_id }, data: { estado: 'COMPLETADO', updatedAt: new Date() } }).catch(() => {})
      }

      // Generar PDF en background — no bloquea la respuesta
      generarPdfVenta(prisma, venta.id)
        .then(result => { if (result) subirPdfBackground(prisma, venta.id, result.buffer, result.filename) })
        .catch(() => {})

      return reply.code(201).send({
        ...venta,
        total: Number(venta.total), subtotal: Number(venta.subtotal),
        descuento: Number(venta.descuento),
        items: venta.items.map(i => ({ ...i, precio_unitario: Number(i.precio_unitario), subtotal: Number(i.subtotal) })),
      })
    } catch (err: any) {
      app.log.error(err)
      return reply.internalServerError('Error al registrar venta')
    }
  })

  // PATCH /ventas/:id/anular
  app.patch('/:id/anular', async (request, reply) => {
    const { id } = request.params as any
    const { motivo } = request.body as any

    const venta = await prisma.venta.findUnique({ where: { id }, include: { items: true } })
    if (!venta) return reply.notFound('Venta no encontrada')
    if (venta.estado === 'ANULADA') return reply.badRequest('La venta ya está anulada')

    await prisma.$transaction(async (tx) => {
      await tx.venta.update({ where: { id }, data: { estado: 'ANULADA', motivo_anulacion: motivo ?? null, updatedAt: new Date() } })

      // Devolver stock
      for (const item of venta.items.filter(i => i.tipo === 'PRODUCTO')) {
        const prod = await tx.producto.findUnique({ where: { id: item.referencia_id } })
        if (prod) {
          const nuevo = prod.stock_actual + item.cantidad
          await tx.producto.update({ where: { id: item.referencia_id }, data: { stock_actual: nuevo, updatedAt: new Date() } })
          await tx.movimientoStock.create({
            data: {
              producto_id: item.referencia_id, tipo: 'AJUSTE_MANUAL',
              cantidad: item.cantidad, stock_resultante: nuevo,
              referencia_id: id, notas: `Anulación venta #${String(venta.numero_comprobante).padStart(6, '0')}`,
            },
          })
        }
      }

      // Restar del total_compras del cliente
      if (venta.cliente_id) {
        await tx.cliente.update({ where: { id: venta.cliente_id }, data: { total_compras: { decrement: Number(venta.total) } } })
      }
    })

    // Restaurar turno a PENDIENTE_FACTURAR si la venta venía de un turno
    if (venta.turno_id) {
      await prisma.turno.update({
        where: { id: venta.turno_id },
        data: { estado: 'PENDIENTE_FACTURAR', updatedAt: new Date() },
      }).catch(() => {})
    }

    return { ok: true }
  })

  // POST /ventas/backfill-numeros — asigna numero_comprobante a ventas que tienen null
  // Ejecutar una sola vez en el servidor después del deploy para corregir datos históricos.
  app.post('/backfill-numeros', async (request, reply) => {
    const secret = (request.query as any).secret
    if (secret !== (process.env.BACKFILL_SECRET ?? 'delfina-backfill-2025')) {
      return reply.status(403).send({ error: 'Forbidden' })
    }

    const sinNumero = await prisma.venta.findMany({
      where: { numero_comprobante: null },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })

    if (sinNumero.length === 0) {
      return { ok: true, actualizadas: 0, mensaje: 'No hay ventas sin número de comprobante' }
    }

    const result = await prisma.$queryRaw<[{ max: number | null }]>`
      SELECT MAX(numero_comprobante) AS max FROM ventas
    `
    let siguiente = (result[0].max ?? 0) + 1

    for (const v of sinNumero) {
      await prisma.venta.update({
        where: { id: v.id },
        data: { numero_comprobante: siguiente },
      })
      siguiente++
    }

    return { ok: true, actualizadas: sinNumero.length, hasta: siguiente - 1 }
  })

  // GET /ventas/hoy/resumen
  app.get('/hoy/resumen', async () => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const fin  = new Date(); fin.setHours(23, 59, 59, 999)

    const ventas = await prisma.venta.findMany({
      where: { createdAt: { gte: hoy, lte: fin }, estado: { in: ['PAGADA', 'PAGO_PARCIAL'] } },
      select: { medio_pago: true, total: true, origen: true },
    })

    const totalDia = ventas.reduce((s, v) => s + Number(v.total), 0)
    const porMedio: Record<string, number> = {}
    for (const v of ventas) { porMedio[v.medio_pago] = (porMedio[v.medio_pago] || 0) + Number(v.total) }

    return { cantidad_ventas: ventas.length, total_dia: totalDia, por_medio_pago: porMedio }
  })

  // GET /ventas/stats?desde=&hasta=
  app.get('/stats', async (request) => {
    const q = request.query as any
    const where: any = { estado: { in: ['PAGADA', 'PAGO_PARCIAL'] } }
    if (q.desde || q.hasta) {
      where.createdAt = {}
      if (q.desde) { const d = new Date(q.desde); d.setHours(0,0,0,0); where.createdAt.gte = d }
      if (q.hasta) { const d = new Date(q.hasta); d.setHours(23,59,59,999); where.createdAt.lte = d }
    }

    const ventas = await prisma.venta.findMany({ where, select: { total: true, medio_pago: true, origen: true, createdAt: true } })

    const total  = ventas.reduce((s, v) => s + Number(v.total), 0)
    const ticket = ventas.length ? total / ventas.length : 0

    const porMedio: Record<string, { cantidad: number; total: number }> = {}
    const porOrigen: Record<string, number> = {}
    const porDia: Record<string, number> = {}
    for (const v of ventas) {
      if (!porMedio[v.medio_pago]) porMedio[v.medio_pago] = { cantidad: 0, total: 0 }
      porMedio[v.medio_pago].cantidad++
      porMedio[v.medio_pago].total += Number(v.total)
      porOrigen[v.origen] = (porOrigen[v.origen] || 0) + Number(v.total)
      const dia = v.createdAt.toISOString().split('T')[0]
      porDia[dia] = (porDia[dia] || 0) + Number(v.total)
    }

    return {
      total, ticket_promedio: Math.round(ticket), cantidad: ventas.length,
      por_medio: Object.entries(porMedio).map(([m, s]) => ({ medio: m, cantidad: s.cantidad, total: s.total })),
      por_origen: Object.entries(porOrigen).map(([o, t]) => ({ origen: o, total: t })),
      serie: Object.entries(porDia).map(([fecha, total]) => ({ fecha, total })).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    }
  })
}
