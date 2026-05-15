import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const schema = z.object({
  codigo: z.string().nullable().optional(),
  nombre: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  especialidad_id: z.string().nullable().optional(),
  duracion_min: z.number().int().positive().optional(),
  precio_particular: z.number().nonnegative().optional(),
  requiere_autorizacion: z.boolean().optional(),
  requiere_consentimiento: z.boolean().optional(),
  requiere_preparacion: z.boolean().optional(),
  instrucciones_preparacion: z.string().nullable().optional(),
  activa: z.boolean().optional(),
  profesionales: z.array(z.string()).optional(),
})

export async function prestacionesRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requirePermiso('prestacion:ver')
    const q = (req.query as any) ?? {}
    const where: any = {}
    if (q.especialidad_id) where.especialidad_id = q.especialidad_id
    if (q.activa !== undefined) where.activa = q.activa === 'true' || q.activa === true
    return prisma.prestacion.findMany({
      where,
      include: { especialidad: true, _count: { select: { profesionales: true } } },
      orderBy: { nombre: 'asc' },
    })
  })

  app.get('/:id', async (req, reply) => {
    req.requirePermiso('prestacion:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    const p = await prisma.prestacion.findUnique({
      where: { id },
      include: {
        especialidad: true,
        profesionales: { include: { profesional: { include: { usuario: { select: { nombre: true, apellido: true } } } } } },
        insumos: { include: { insumo: true } },
      },
    })
    if (!p) return notFound(reply, 'Prestacion')
    return p
  })

  app.post('/', async (req, reply) => {
    const user = req.requirePermiso('prestacion:editar', { flexible: true })
    const data = parseOrFail(schema, req.body)
    const { profesionales, ...fields } = data
    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.prestacion.create({
        data: { ...fields, precio_particular: (fields.precio_particular ?? 0) as any },
      })
      if (profesionales?.length) {
        await tx.profesionalPrestacion.createMany({
          data: profesionales.map((profesional_id) => ({ profesional_id, prestacion_id: p.id })),
        })
      }
      return p
    })
    await writeAudit({ usuario_id: user.id, accion: 'CREAR', entidad: 'Prestacion', entidad_id: created.id, diff: data, ...auditMetaFromRequest(req) })
    return reply.code(201).send(created)
  })

  app.patch('/:id', async (req, reply) => {
    const user = req.requirePermiso('prestacion:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(schema.partial(), req.body)
    const { profesionales, ...fields } = data
    const existing = await prisma.prestacion.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Prestacion')

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.prestacion.update({
        where: { id },
        data: {
          ...fields,
          precio_particular: fields.precio_particular !== undefined ? (fields.precio_particular as any) : undefined,
        },
      })
      if (profesionales) {
        await tx.profesionalPrestacion.deleteMany({ where: { prestacion_id: id } })
        await tx.profesionalPrestacion.createMany({
          data: profesionales.map((profesional_id) => ({ profesional_id, prestacion_id: id })),
        })
      }
      return p
    })

    await writeAudit({ usuario_id: user.id, accion: 'MODIFICAR', entidad: 'Prestacion', entidad_id: id, diff: data, ...auditMetaFromRequest(req) })
    return updated
  })
}
