import type { FastifyInstance } from 'fastify'
import { TipoMovimiento } from '@prisma/client'

export async function stockRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  app.get('/', async (request) => {
    const q = (request.query as any)
    const where: any = { activo: true }
    if (q.categoria) where.categoria = q.categoria
    if (q.q) where.nombre = { contains: q.q, mode: 'insensitive' }

    const productos = await prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
      select: {
        id: true, nombre: true, sku: true, categoria: true,
        stock_actual: true, stock_minimo: true,
        precio_minorista: true, precio_mayorista: true, activo: true,
      }
    })

    let result = productos.map(p => ({
      ...p,
      precio_minorista: Number(p.precio_minorista),
      precio_mayorista: p.precio_mayorista ? Number(p.precio_mayorista) : null,
      estado: p.stock_actual <= 0 ? 'CRITICO' : p.stock_actual <= p.stock_minimo ? 'BAJO' : 'OK'
    }))

    if (q.critico === 'true') result = result.filter(p => p.estado !== 'OK')

    return { data: result, total: result.length }
  })

  app.get('/bajo-minimo', async () => {
    const productos = await app.prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    })
    return productos
      .filter(p => p.stock_actual <= p.stock_minimo)
      .map(p => ({
        ...p,
        precio_minorista: Number(p.precio_minorista),
        precio_mayorista: p.precio_mayorista ? Number(p.precio_mayorista) : null,
      }))
  })

  app.get('/movimientos', async (request) => {
    const q = (request.query as any)
    const where: any = {}
    if (q.producto_id) where.producto_id = q.producto_id
    if (q.tipo) where.tipo = q.tipo

    const movimientos = await prisma.movimientoStock.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Number(q.limit ?? 50),
      include: {
        producto: { select: { id: true, nombre: true, sku: true } }
      }
    })
    return { data: movimientos, total: movimientos.length }
  })

  // POST /stock/movimiento — FIX: acepta cantidad positiva o negativa según tipo
  app.post('/movimiento', async (request, reply) => {
    const body = request.body as any

    if (!body.producto_id || body.cantidad === undefined || !body.tipo) {
      return reply.code(400).send({ error: 'Faltan campos: producto_id, cantidad, tipo' })
    }

    const producto = await prisma.producto.findUnique({ where: { id: body.producto_id } })
    if (!producto) return reply.code(404).send({ error: 'Producto no encontrado' })

    let cantidad = Number(body.cantidad)

    // Si el tipo descuenta, forzar negativo
    const tiposEgreso: string[] = ['VENTA_LOCAL', 'VENTA_ONLINE', 'USO_SERVICIO']
    if (tiposEgreso.includes(body.tipo)) {
      cantidad = -Math.abs(cantidad)
    } else if (body.tipo === 'AJUSTE_MANUAL') {
      // AJUSTE_MANUAL: respetar el signo que manda el cliente
      cantidad = Number(body.cantidad)
    } else {
      // ENTRADA: siempre positivo
      cantidad = Math.abs(cantidad)
    }

    const stockResultante = producto.stock_actual + cantidad

    if (stockResultante < 0) {
      return reply.code(400).send({
        error: `Stock insuficiente. Stock actual: ${producto.stock_actual}, ajuste: ${cantidad}, resultante: ${stockResultante}`
      })
    }

    const movimiento = await prisma.$transaction(async (tx) => {
      await tx.producto.update({
        where: { id: producto.id },
        data: { stock_actual: stockResultante },
      })
      return tx.movimientoStock.create({
        data: {
          producto_id: producto.id,
          tipo: body.tipo as TipoMovimiento,
          cantidad,
          stock_resultante: stockResultante,
          referencia_id: body.referencia_id ?? null,
          notas: body.notas ?? null,
        },
        include: {
          producto: { select: { id: true, nombre: true, sku: true } }
        }
      })
    })

    return reply.code(201).send(movimiento)
  })

  app.patch('/:id/minimo', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as any
    if (body.stock_minimo === undefined) return reply.code(400).send({ error: 'Falta stock_minimo' })
    const producto = await prisma.producto.findUnique({ where: { id } })
    if (!producto) return reply.code(404).send({ error: 'Producto no encontrado' })
    return prisma.producto.update({ where: { id }, data: { stock_minimo: Number(body.stock_minimo) } })
  })
}
