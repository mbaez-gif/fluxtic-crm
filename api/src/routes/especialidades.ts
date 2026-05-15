import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const schema = z.object({
  nombre: z.string().min(1),
  codigo: z.string().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  activa: z.boolean().optional(),
})

export async function especialidadesRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requirePermiso('especialidad:ver')
    return prisma.especialidad.findMany({ orderBy: { nombre: 'asc' } })
  })

  app.get('/:id', async (req, reply) => {
    req.requirePermiso('especialidad:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    const e = await prisma.especialidad.findUnique({
      where: { id },
      include: {
        _count: { select: { profesionales: true, prestaciones: true } },
      },
    })
    if (!e) return notFound(reply, 'Especialidad')
    return e
  })

  app.post('/', async (req, reply) => {
    const user = req.requirePermiso('especialidad:editar', { flexible: true })
    const data = parseOrFail(schema, req.body)
    const e = await prisma.especialidad.create({ data })
    await writeAudit({ usuario_id: user.id, accion: 'CREAR', entidad: 'Especialidad', entidad_id: e.id, diff: data, ...auditMetaFromRequest(req) })
    return reply.code(201).send(e)
  })

  app.patch('/:id', async (req, reply) => {
    const user = req.requirePermiso('especialidad:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(schema.partial(), req.body)
    const existing = await prisma.especialidad.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Especialidad')
    const e = await prisma.especialidad.update({ where: { id }, data })
    await writeAudit({ usuario_id: user.id, accion: 'MODIFICAR', entidad: 'Especialidad', entidad_id: id, diff: data, ...auditMetaFromRequest(req) })
    return e
  })
}
