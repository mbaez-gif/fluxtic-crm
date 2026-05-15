import type { FastifyInstance } from 'fastify'
import { CategoriaProducto } from '@prisma/client'

export async function productosRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  app.get('/', async (request) => {
    const q = (request.query as any)
    const where: any = {}
    if (q.categoria) where.categoria = q.categoria
    if (q.activo !== undefined) where.activo = q.activo === 'true'
    if (q.q) where.nombre = { contains: q.q, mode: 'insensitive' }

    const productos = await prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
    })
    return {
      data: productos.map(p => ({
        ...p,
        precio_minorista: Number(p.precio_minorista),
        precio_mayorista: p.precio_mayorista ? Number(p.precio_mayorista) : null,
      })),
      total: productos.length
    }
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const p = await prisma.producto.findUnique({
      where: { id },
      include: {
        movimientos: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { movimientos: true } }
      }
    })
    if (!p) return reply.code(404).send({ error: 'Producto no encontrado' })
    return {
      data: {
        ...p,
        precio_minorista: Number(p.precio_minorista),
        precio_mayorista: p.precio_mayorista ? Number(p.precio_mayorista) : null,
      }
    }
  })

  app.post('/', async (request, reply) => {
    const body = request.body as any
    if (!body.nombre || !body.categoria) {
      return reply.code(400).send({ error: 'Faltan campos obligatorios' })
    }
    const producto = await prisma.producto.create({
      data: {
        nombre: body.nombre,
        sku: body.sku ?? null,
        categoria: body.categoria as CategoriaProducto,
        precio_minorista: Number(body.precio_minorista ?? 0),
        precio_mayorista: body.precio_mayorista ? Number(body.precio_mayorista) : null,
        stock_actual: Number(body.stock_actual ?? 0),
        stock_minimo: Number(body.stock_minimo ?? 5),
        foto_url: body.foto_url ?? null,
        tiendanube_prod_id: body.tiendanube_prod_id ?? null,
        tiendanube_var_id: body.tiendanube_var_id ?? null,
        activo: body.activo ?? true,
      },
    })
    return reply.code(201).send({
      ...producto,
      precio_minorista: Number(producto.precio_minorista),
      precio_mayorista: producto.precio_mayorista ? Number(producto.precio_mayorista) : null,
    })
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as any
    const existe = await prisma.producto.findUnique({ where: { id } })
    if (!existe) return reply.code(404).send({ error: 'Producto no encontrado' })

    const producto = await prisma.producto.update({
      where: { id },
      data: {
        ...(body.nombre !== undefined && { nombre: body.nombre }),
        ...(body.sku !== undefined && { sku: body.sku }),
        ...(body.categoria !== undefined && { categoria: body.categoria as CategoriaProducto }),
        ...(body.precio_minorista !== undefined && { precio_minorista: Number(body.precio_minorista) }),
        ...(body.precio_mayorista !== undefined && { precio_mayorista: body.precio_mayorista ? Number(body.precio_mayorista) : null }),
        ...(body.stock_minimo !== undefined && { stock_minimo: Number(body.stock_minimo) }),
        ...(body.activo !== undefined && { activo: body.activo }),
        ...(body.foto_url !== undefined && { foto_url: body.foto_url }),
      },
    })
    return {
      ...producto,
      precio_minorista: Number(producto.precio_minorista),
      precio_mayorista: producto.precio_mayorista ? Number(producto.precio_mayorista) : null,
    }
  })

  // DELETE /productos/:id
  // Si tiene movimientos → soft delete (activo: false)
  // Si no tiene movimientos → eliminar real
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as any
    const forzar = body?.forzar === true

    const existe = await prisma.producto.findUnique({
      where: { id },
      include: { _count: { select: { movimientos: true } } }
    })
    if (!existe) return reply.code(404).send({ error: 'Producto no encontrado' })

    const tieneMovimientos = existe._count.movimientos > 0

    if (tieneMovimientos && !forzar) {
      // Soft delete
      await prisma.producto.update({ where: { id }, data: { activo: false } })
      return reply.send({ ok: true, tipo: 'desactivado', mensaje: 'Producto desactivado (tiene movimientos de stock)' })
    }

    // Eliminar real (borrar movimientos primero si forzar)
    if (tieneMovimientos && forzar) {
      await prisma.movimientoStock.deleteMany({ where: { producto_id: id } })
    }

    await prisma.producto.delete({ where: { id } })
    return reply.send({ ok: true, tipo: 'eliminado' })
  })
}
