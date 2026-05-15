import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const coberturaSchema = z.object({
  nombre: z.string().min(1),
  tipo: z.enum(['PARTICULAR', 'OBRA_SOCIAL', 'PREPAGA']),
  codigo: z.string().nullable().optional(),
  cuit: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  activa: z.boolean().optional(),
})

const planSchema = z.object({
  cobertura_id: z.string(),
  nombre: z.string().min(1),
  codigo: z.string().nullable().optional(),
  porcentaje_cobertura: z.number().min(0).max(100).nullable().optional(),
  observaciones: z.string().nullable().optional(),
  activo: z.boolean().optional(),
})

export async function coberturasRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requirePermiso('cobertura:ver')
    return prisma.coberturaMedica.findMany({
      include: { planes: { orderBy: { nombre: 'asc' } } },
      orderBy: { nombre: 'asc' },
    })
  })

  app.get('/:id', async (req, reply) => {
    req.requirePermiso('cobertura:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    const c = await prisma.coberturaMedica.findUnique({
      where: { id },
      include: { planes: true, _count: { select: { afiliaciones: true } } },
    })
    if (!c) return notFound(reply, 'Cobertura')
    return c
  })

  app.post('/', async (req, reply) => {
    const user = req.requirePermiso('cobertura:editar', { flexible: true })
    const data = parseOrFail(coberturaSchema, req.body)
    const c = await prisma.coberturaMedica.create({ data })
    await writeAudit({ usuario_id: user.id, accion: 'CREAR', entidad: 'CoberturaMedica', entidad_id: c.id, diff: data, ...auditMetaFromRequest(req) })
    return reply.code(201).send(c)
  })

  app.patch('/:id', async (req, reply) => {
    const user = req.requirePermiso('cobertura:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(coberturaSchema.partial(), req.body)
    const existing = await prisma.coberturaMedica.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Cobertura')
    const c = await prisma.coberturaMedica.update({ where: { id }, data })
    await writeAudit({ usuario_id: user.id, accion: 'MODIFICAR', entidad: 'CoberturaMedica', entidad_id: id, diff: data, ...auditMetaFromRequest(req) })
    return c
  })

  // Planes
  app.post('/planes', async (req, reply) => {
    const user = req.requirePermiso('cobertura:editar', { flexible: true })
    const data = parseOrFail(planSchema, req.body)
    const p = await prisma.planCobertura.create({
      data: { ...data, porcentaje_cobertura: data.porcentaje_cobertura as any },
    })
    await writeAudit({ usuario_id: user.id, accion: 'CREAR', entidad: 'PlanCobertura', entidad_id: p.id, diff: data, ...auditMetaFromRequest(req) })
    return reply.code(201).send(p)
  })

  app.patch('/planes/:id', async (req, reply) => {
    const user = req.requirePermiso('cobertura:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(planSchema.partial(), req.body)
    const p = await prisma.planCobertura.update({
      where: { id },
      data: { ...data, porcentaje_cobertura: data.porcentaje_cobertura as any },
    })
    await writeAudit({ usuario_id: user.id, accion: 'MODIFICAR', entidad: 'PlanCobertura', entidad_id: id, diff: data, ...auditMetaFromRequest(req) })
    return p
  })
}
