import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const insumoSchema = z.object({
  codigo: z.string().nullable().optional(),
  nombre: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  unidad: z.string().optional(),
  stock_minimo: z.number().int().nonnegative().optional(),
  proveedor: z.string().nullable().optional(),
  precio_unitario: z.number().nonnegative().nullable().optional(),
  activo: z.boolean().optional(),
})

const loteSchema = z.object({
  insumo_id: z.string(),
  numero_lote: z.string().min(1),
  vencimiento: z.string().datetime().nullable().optional(),
  cantidad: z.number().int().nonnegative(),
})

const movimientoSchema = z.object({
  insumo_id: z.string(),
  lote_id: z.string().nullable().optional(),
  tipo: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE', 'USO_PRESTACION', 'VENCIMIENTO']),
  cantidad: z.number().int().positive(),
  observaciones: z.string().nullable().optional(),
  prestacion_id: z.string().nullable().optional(),
  turno_id: z.string().nullable().optional(),
})

export async function insumosRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requireAuth()
    const q = (req.query as any) ?? {}
    const where: any = {}
    if (q.bajo_stock === 'true') {
      // Insumos cuyo stock_actual <= stock_minimo
      return prisma.$queryRaw`
        SELECT * FROM "Insumo"
        WHERE "deleted_at" IS NULL AND "activo" = true AND "stock_actual" <= "stock_minimo"
        ORDER BY "nombre" ASC
      `
    }
    if (q.q) {
      where.OR = [
        { nombre: { contains: String(q.q), mode: 'insensitive' } },
        { codigo: { contains: String(q.q) } },
      ]
    }
    return prisma.insumo.findMany({
      where,
      include: { lotes: { orderBy: { vencimiento: 'asc' } }, _count: { select: { movimientos: true } } },
      orderBy: { nombre: 'asc' },
    })
  })

  app.get('/:id', async (req, reply) => {
    req.requireAuth()
    const { id } = parseOrFail(idParamSchema, req.params)
    const i = await prisma.insumo.findUnique({
      where: { id },
      include: {
        lotes: { orderBy: { vencimiento: 'asc' } },
        movimientos: { orderBy: { created_at: 'desc' }, take: 50 },
      },
    })
    if (!i) return notFound(reply, 'Insumo')
    return i
  })

  app.post('/', async (req, reply) => {
    const user = req.requireAuth()
    const data = parseOrFail(insumoSchema, req.body)
    const i = await prisma.insumo.create({
      data: { ...data, precio_unitario: data.precio_unitario as any },
    })
    await writeAudit({ usuario_id: user.id, accion: 'CREAR', entidad: 'Insumo', entidad_id: i.id, diff: data, ...auditMetaFromRequest(req) })
    return reply.code(201).send(i)
  })

  app.patch('/:id', async (req, reply) => {
    const user = req.requireAuth()
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(insumoSchema.partial(), req.body)
    const i = await prisma.insumo.update({
      where: { id },
      data: { ...data, precio_unitario: data.precio_unitario as any },
    })
    await writeAudit({ usuario_id: user.id, accion: 'MODIFICAR', entidad: 'Insumo', entidad_id: id, diff: data, ...auditMetaFromRequest(req) })
    return i
  })

  // ── Lotes ────────────────────────────────────────────────────
  app.post('/lotes', async (req, reply) => {
    const user = req.requireAuth()
    const data = parseOrFail(loteSchema, req.body)
    const l = await prisma.loteInsumo.create({
      data: {
        insumo_id: data.insumo_id,
        numero_lote: data.numero_lote,
        vencimiento: data.vencimiento ? new Date(data.vencimiento) : null,
        cantidad: data.cantidad,
      },
    })
    // Sumar stock_actual del insumo
    await prisma.insumo.update({
      where: { id: data.insumo_id },
      data: { stock_actual: { increment: data.cantidad } },
    })
    await prisma.movimientoStock.create({
      data: {
        insumo_id: data.insumo_id,
        lote_id: l.id,
        tipo: 'ENTRADA',
        cantidad: data.cantidad,
        usuario_id: user.id,
        observaciones: `Alta de lote ${data.numero_lote}`,
      },
    })
    return reply.code(201).send(l)
  })

  // ── Movimientos de stock ─────────────────────────────────────
  app.post('/movimientos', async (req, reply) => {
    const user = req.requireAuth()
    const data = parseOrFail(movimientoSchema, req.body)
    const delta = data.tipo === 'ENTRADA' ? data.cantidad : -data.cantidad
    const m = await prisma.$transaction(async (tx) => {
      const mov = await tx.movimientoStock.create({
        data: {
          insumo_id: data.insumo_id,
          lote_id: data.lote_id ?? null,
          tipo: data.tipo,
          cantidad: data.cantidad,
          usuario_id: user.id,
          observaciones: data.observaciones ?? null,
          prestacion_id: data.prestacion_id ?? null,
          turno_id: data.turno_id ?? null,
        },
      })
      await tx.insumo.update({
        where: { id: data.insumo_id },
        data: { stock_actual: { increment: delta } },
      })
      if (data.lote_id) {
        await tx.loteInsumo.update({
          where: { id: data.lote_id },
          data: { cantidad: { increment: delta } },
        })
      }
      return mov
    })
    return reply.code(201).send(m)
  })

  // ── Alertas (vencimiento próximo y stock crítico) ───────────
  app.get('/alertas', async (req) => {
    req.requireAuth()
    const horizonte = 30 // días
    const limite = new Date(Date.now() + horizonte * 24 * 3600 * 1000)
    const [vencimientos, criticos] = await Promise.all([
      prisma.loteInsumo.findMany({
        where: { vencimiento: { not: null, lte: limite }, cantidad: { gt: 0 } },
        include: { insumo: true },
        orderBy: { vencimiento: 'asc' },
      }),
      prisma.$queryRaw<Array<{ id: string; nombre: string; stock_actual: number; stock_minimo: number }>>`
        SELECT id, nombre, stock_actual, stock_minimo FROM "Insumo"
        WHERE "deleted_at" IS NULL AND "activo" = true AND "stock_actual" <= "stock_minimo"
      `,
    ])
    return { vencimientos, stock_critico: criticos }
  })
}
