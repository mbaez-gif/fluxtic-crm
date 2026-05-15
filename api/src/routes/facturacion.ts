import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const medioPago = z.enum(['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'MERCADOPAGO', 'CHEQUE', 'COBERTURA'])

const itemSchema = z.object({
  prestacion_id: z.string().nullable().optional(),
  descripcion: z.string().min(1),
  cantidad: z.number().int().positive().default(1),
  precio_unitario: z.number().nonnegative(),
})

const comprobanteSchema = z.object({
  paciente_id: z.string(),
  turno_id: z.string().nullable().optional(),
  tipo: z.enum(['RECIBO', 'FACTURA', 'PRESUPUESTO', 'NOTA_CREDITO']).optional(),
  descuento: z.number().nonnegative().optional(),
  observaciones: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1),
})

const pagoSchema = z.object({
  comprobante_id: z.string().nullable().optional(),
  paciente_id: z.string(),
  monto: z.number().positive(),
  medio: medioPago,
  referencia_externa: z.string().nullable().optional(),
  cobertura_id: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
})

export async function facturacionRoutes(app: FastifyInstance) {
  // ── Comprobantes ─────────────────────────────────────────────
  app.get('/comprobantes', async (req) => {
    req.requirePermiso('comprobante:ver')
    const q = (req.query as any) ?? {}
    const where: any = {}
    if (q.paciente_id) where.paciente_id = q.paciente_id
    if (q.estado) where.estado = q.estado
    if (q.desde || q.hasta) {
      where.fecha = {}
      if (q.desde) where.fecha.gte = new Date(q.desde)
      if (q.hasta) where.fecha.lte = new Date(q.hasta)
    }
    return prisma.comprobante.findMany({
      where,
      include: {
        paciente: { select: { id: true, nombre: true, apellido: true, dni: true } },
        _count: { select: { items: true, pagos: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 100,
    })
  })

  app.get('/comprobantes/:id', async (req, reply) => {
    req.requirePermiso('comprobante:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    const c = await prisma.comprobante.findUnique({
      where: { id },
      include: {
        paciente: true,
        items: true,
        pagos: { orderBy: { fecha: 'desc' } },
        turno: { select: { id: true, fecha_hora: true } },
      },
    })
    if (!c) return notFound(reply, 'Comprobante')
    return c
  })

  app.post('/comprobantes', async (req, reply) => {
    const user = req.requirePermiso('comprobante:crear', { flexible: true })
    const data = parseOrFail(comprobanteSchema, req.body)
    const subtotal = data.items.reduce(
      (acc, it) => acc + it.cantidad * it.precio_unitario,
      0,
    )
    const total = subtotal - (data.descuento ?? 0)
    const c = await prisma.comprobante.create({
      data: {
        paciente_id: data.paciente_id,
        turno_id: data.turno_id ?? null,
        tipo: data.tipo ?? 'RECIBO',
        subtotal: subtotal as any,
        descuento: (data.descuento ?? 0) as any,
        total: total as any,
        saldo: total as any,
        estado: 'EMITIDO',
        observaciones: data.observaciones ?? null,
        creado_por_id: user.id,
        items: {
          create: data.items.map((it) => ({
            prestacion_id: it.prestacion_id ?? null,
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precio_unitario: it.precio_unitario as any,
            subtotal: (it.cantidad * it.precio_unitario) as any,
          })),
        },
      },
      include: { items: true },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Comprobante',
      entidad_id: c.id,
      contexto: { paciente_id: data.paciente_id },
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(c)
  })

  app.post('/comprobantes/:id/anular', async (req, reply) => {
    const user = req.requirePermiso('comprobante:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const motivo = (req.body as any)?.motivo
    if (!motivo) return reply.code(400).send({ error: 'Bad request', message: 'motivo requerido' })
    const c = await prisma.comprobante.update({
      where: { id },
      data: { estado: 'ANULADO', anulado_at: new Date(), anulado_motivo: motivo },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'Comprobante',
      entidad_id: id,
      descripcion: `Anulado: ${motivo}`,
      ...auditMetaFromRequest(req),
    })
    return c
  })

  // ── Pagos ────────────────────────────────────────────────────
  app.get('/pagos', async (req) => {
    req.requirePermiso('pago:ver', { flexible: true })
    const q = (req.query as any) ?? {}
    const where: any = {}
    if (q.paciente_id) where.paciente_id = q.paciente_id
    if (q.desde || q.hasta) {
      where.fecha = {}
      if (q.desde) where.fecha.gte = new Date(q.desde)
      if (q.hasta) where.fecha.lte = new Date(q.hasta)
    }
    return prisma.pago.findMany({
      where,
      include: {
        paciente: { select: { id: true, nombre: true, apellido: true, dni: true } },
        comprobante: { select: { id: true, numero: true, total: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 100,
    })
  })

  app.post('/pagos', async (req, reply) => {
    const user = req.requirePermiso('pago:crear', { flexible: true })
    const data = parseOrFail(pagoSchema, req.body)
    const pago = await prisma.$transaction(async (tx) => {
      const p = await tx.pago.create({
        data: {
          comprobante_id: data.comprobante_id ?? null,
          paciente_id: data.paciente_id,
          monto: data.monto as any,
          medio: data.medio,
          referencia_externa: data.referencia_externa ?? null,
          cobertura_id: data.cobertura_id ?? null,
          registrado_por_id: user.id,
          observaciones: data.observaciones ?? null,
        },
      })
      if (data.comprobante_id) {
        const c = await tx.comprobante.findUnique({ where: { id: data.comprobante_id } })
        if (c) {
          const pagado = Number(c.total_pagado) + data.monto
          const saldo = Number(c.total) - pagado
          await tx.comprobante.update({
            where: { id: data.comprobante_id },
            data: {
              total_pagado: pagado as any,
              saldo: saldo as any,
              estado: saldo <= 0 ? 'PAGADO' : 'PAGO_PARCIAL',
            },
          })
        }
      }
      await tx.movimientoCaja.create({
        data: {
          pago_id: p.id,
          usuario_id: user.id,
          tipo: 'INGRESO',
          monto: data.monto as any,
          medio: data.medio,
          concepto: data.observaciones ?? 'Pago de comprobante',
        },
      })
      return p
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Pago',
      entidad_id: pago.id,
      contexto: { paciente_id: data.paciente_id, comprobante_id: data.comprobante_id ?? null },
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(pago)
  })

  // ── Caja diaria ──────────────────────────────────────────────
  app.get('/caja', async (req) => {
    req.requirePermiso('caja:ver')
    const q = (req.query as any) ?? {}
    const desde = q.desde ? new Date(q.desde) : new Date(new Date().setHours(0, 0, 0, 0))
    const hasta = q.hasta ? new Date(q.hasta) : new Date(new Date().setHours(23, 59, 59, 999))
    const movimientos = await prisma.movimientoCaja.findMany({
      where: { fecha: { gte: desde, lte: hasta } },
      include: {
        usuario: { select: { id: true, nombre: true, apellido: true } },
        pago: { include: { paciente: { select: { id: true, nombre: true, apellido: true } } } },
      },
      orderBy: { fecha: 'desc' },
    })
    const totales = movimientos.reduce<Record<string, number>>((acc, m) => {
      acc[m.medio] = (acc[m.medio] ?? 0) + (m.tipo === 'INGRESO' ? Number(m.monto) : -Number(m.monto))
      return acc
    }, {})
    return { movimientos, totales, desde, hasta }
  })

  // ── Deudas ───────────────────────────────────────────────────
  app.get('/deudas', async (req) => {
    req.requirePermiso('deuda:ver')
    return prisma.deuda.findMany({
      where: { saldo_actual: { gt: 0 } },
      include: { paciente: { select: { id: true, nombre: true, apellido: true, dni: true } } },
      orderBy: { fecha_origen: 'desc' },
    })
  })
}
