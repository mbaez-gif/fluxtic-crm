import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const sedeSchema = z.object({
  nombre: z.string().min(1),
  direccion: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  provincia: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  activa: z.boolean().optional(),
})

export async function sedesRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requirePermiso('sede:ver')
    return prisma.sede.findMany({ orderBy: { nombre: 'asc' } })
  })

  app.get('/:id', async (req, reply) => {
    req.requirePermiso('sede:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    const sede = await prisma.sede.findUnique({
      where: { id },
      include: { consultorios: true, _count: { select: { turnos: true } } },
    })
    if (!sede) return notFound(reply, 'Sede')
    return sede
  })

  app.post('/', async (req, reply) => {
    const user = req.requirePermiso('sede:crear', { flexible: true })
    const data = parseOrFail(sedeSchema, req.body)
    const sede = await prisma.sede.create({ data })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Sede',
      entidad_id: sede.id,
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(sede)
  })

  app.patch('/:id', async (req, reply) => {
    const user = req.requirePermiso('sede:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(sedeSchema.partial(), req.body)
    const existing = await prisma.sede.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Sede')
    const sede = await prisma.sede.update({ where: { id }, data })
    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'Sede',
      entidad_id: id,
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return sede
  })

  app.delete('/:id', async (req, reply) => {
    const user = req.requirePermiso('sede:eliminar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const motivo = (req.body as any)?.motivo as string | undefined
    const existing = await prisma.sede.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Sede')
    // Sede no tiene soft-delete; usa flag activa
    await prisma.sede.update({ where: { id }, data: { activa: false } })
    await writeAudit({
      usuario_id: user.id,
      accion: 'ELIMINAR',
      entidad: 'Sede',
      entidad_id: id,
      descripcion: motivo,
      ...auditMetaFromRequest(req),
    })
    return reply.code(204).send()
  })

  // Consultorios anidados
  const consultorioSchema = z.object({
    sede_id: z.string(),
    nombre: z.string().min(1),
    numero: z.string().nullable().optional(),
    descripcion: z.string().nullable().optional(),
    activo: z.boolean().optional(),
  })
  app.get('/:id/consultorios', async (req, reply) => {
    req.requirePermiso('sede:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    return prisma.consultorio.findMany({ where: { sede_id: id }, orderBy: { nombre: 'asc' } })
  })
  app.post('/consultorios', async (req, reply) => {
    const user = req.requirePermiso('sede:editar', { flexible: true })
    const data = parseOrFail(consultorioSchema, req.body)
    const c = await prisma.consultorio.create({ data })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Consultorio',
      entidad_id: c.id,
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(c)
  })
}
