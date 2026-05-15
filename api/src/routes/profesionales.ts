import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  telefono: z.string().nullable().optional(),
  rol: z.enum(['MEDICO', 'COORDINADOR_MEDICO']).default('MEDICO'),
  matricula: z.string().min(1),
  matricula_jurisdiccion: z.string().nullable().optional(),
  especialidad_id: z.string(),
  subespecialidad: z.string().nullable().optional(),
  duracion_consulta_min: z.number().int().positive().optional(),
  porcentaje_liquidacion: z.number().min(0).max(100).optional(),
  color_agenda: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  sedes: z.array(z.string()).optional(),
})

const updateSchema = createSchema.partial().omit({ password: true })

export async function profesionalesRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requirePermiso('profesional:ver')
    const q = (req.query as any) ?? {}
    const where: any = {}
    if (q.especialidad_id) where.especialidad_id = q.especialidad_id
    return prisma.perfilProfesional.findMany({
      where,
      include: {
        usuario: { select: { id: true, email: true, nombre: true, apellido: true, activo: true } },
        especialidad: true,
        sedes: { include: { sede: true } },
        _count: { select: { turnos: true } },
      },
      orderBy: [{ usuario: { apellido: 'asc' } }, { usuario: { nombre: 'asc' } }],
    })
  })

  app.get('/:id', async (req, reply) => {
    req.requirePermiso('profesional:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    const p = await prisma.perfilProfesional.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, email: true, nombre: true, apellido: true, telefono: true, activo: true, rol: true } },
        especialidad: true,
        sedes: { include: { sede: true } },
        horarios: { orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }] },
        prestaciones: { include: { prestacion: true } },
      },
    })
    if (!p) return notFound(reply, 'Profesional')
    return p
  })

  app.post('/', async (req, reply) => {
    const user = req.requirePermiso('profesional:editar', { flexible: true })
    const data = parseOrFail(createSchema, req.body)
    const password_hash = await bcrypt.hash(data.password, 10)
    const created = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          email: data.email,
          password: password_hash,
          nombre: data.nombre,
          apellido: data.apellido,
          telefono: data.telefono ?? undefined,
          rol: data.rol,
          es_profesional: true,
        },
      })
      const perfil = await tx.perfilProfesional.create({
        data: {
          usuario_id: usuario.id,
          matricula: data.matricula,
          matricula_jurisdiccion: data.matricula_jurisdiccion ?? undefined,
          especialidad_id: data.especialidad_id,
          subespecialidad: data.subespecialidad ?? undefined,
          duracion_consulta_min: data.duracion_consulta_min ?? 30,
          porcentaje_liquidacion: data.porcentaje_liquidacion as any,
          color_agenda: data.color_agenda ?? undefined,
          bio: data.bio ?? undefined,
        },
      })
      if (data.sedes?.length) {
        await tx.profesionalSede.createMany({
          data: data.sedes.map((sede_id) => ({ profesional_id: perfil.id, sede_id })),
        })
      }
      return { usuario, perfil }
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'PerfilProfesional',
      entidad_id: created.perfil.id,
      diff: { ...data, password: '[REDACTED]' },
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(created.perfil)
  })

  app.patch('/:id', async (req, reply) => {
    const user = req.requirePermiso('profesional:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(updateSchema, req.body)
    const perfil = await prisma.perfilProfesional.findUnique({ where: { id } })
    if (!perfil) return notFound(reply, 'Profesional')

    const usuarioFields: any = {}
    if (data.nombre !== undefined) usuarioFields.nombre = data.nombre
    if (data.apellido !== undefined) usuarioFields.apellido = data.apellido
    if (data.email !== undefined) usuarioFields.email = data.email
    if (data.telefono !== undefined) usuarioFields.telefono = data.telefono
    if (data.rol !== undefined) usuarioFields.rol = data.rol

    const perfilFields: any = {}
    for (const k of ['matricula', 'matricula_jurisdiccion', 'especialidad_id', 'subespecialidad', 'duracion_consulta_min', 'porcentaje_liquidacion', 'color_agenda', 'bio'] as const) {
      if ((data as any)[k] !== undefined) perfilFields[k] = (data as any)[k]
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(usuarioFields).length) {
        await tx.usuario.update({ where: { id: perfil.usuario_id }, data: usuarioFields })
      }
      const p = await tx.perfilProfesional.update({ where: { id }, data: perfilFields })
      if (data.sedes) {
        await tx.profesionalSede.deleteMany({ where: { profesional_id: id } })
        await tx.profesionalSede.createMany({
          data: data.sedes.map((sede_id) => ({ profesional_id: id, sede_id })),
        })
      }
      return p
    })

    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'PerfilProfesional',
      entidad_id: id,
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return updated
  })

  // Horarios CRUD
  const horarioSchema = z.object({
    profesional_id: z.string(),
    sede_id: z.string().nullable().optional(),
    dia_semana: z.number().int().min(0).max(6),
    hora_inicio: z.string().regex(/^\d{2}:\d{2}$/),
    hora_fin: z.string().regex(/^\d{2}:\d{2}$/),
    activo: z.boolean().optional(),
  })

  app.post('/horarios', async (req, reply) => {
    req.requirePermiso('profesional:editar', { flexible: true })
    const data = parseOrFail(horarioSchema, req.body)
    const h = await prisma.horarioProfesional.create({ data })
    return reply.code(201).send(h)
  })

  app.delete('/horarios/:id', async (req, reply) => {
    req.requirePermiso('profesional:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    await prisma.horarioProfesional.delete({ where: { id } })
    return reply.code(204).send()
  })
}
