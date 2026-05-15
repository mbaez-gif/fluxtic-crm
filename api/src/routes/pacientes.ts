import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const sexoEnum = z.enum(['FEMENINO', 'MASCULINO', 'OTRO', 'SIN_DATO'])

const pacienteSchema = z.object({
  dni: z.string().min(6),
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  fecha_nacimiento: z.string().datetime().nullable().optional(),
  sexo: sexoEnum.optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  direccion: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  provincia: z.string().nullable().optional(),
  ocupacion: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO', 'EN_SEGUIMIENTO', 'BLOQUEADO']).optional(),
})

const contactoSchema = z.object({
  paciente_id: z.string(),
  nombre: z.string().min(1),
  vinculo: z.string().nullable().optional(),
  telefono: z.string().min(1),
  email: z.string().email().nullable().optional(),
  prioritario: z.boolean().optional(),
})

const afiliacionSchema = z.object({
  cobertura_id: z.string(),
  plan_id: z.string().nullable().optional(),
  numero_afiliado: z.string().min(1),
  vigencia_desde: z.string().datetime().nullable().optional(),
  vigencia_hasta: z.string().datetime().nullable().optional(),
  principal: z.boolean().optional(),
  activa: z.boolean().optional(),
})

export async function pacientesRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requirePermiso('paciente:ver')
    const q = (req.query as any) ?? {}
    const where: any = {}
    if (q.q) {
      const term = String(q.q)
      where.OR = [
        { dni: { contains: term } },
        { apellido: { contains: term, mode: 'insensitive' } },
        { nombre: { contains: term, mode: 'insensitive' } },
      ]
    }
    if (q.estado) where.estado = q.estado
    const take = Math.min(parseInt(q.limit ?? '50', 10), 200)
    const skip = parseInt(q.offset ?? '0', 10)
    const [data, total] = await Promise.all([
      prisma.paciente.findMany({
        where,
        take,
        skip,
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        include: {
          coberturas: {
            where: { principal: true, activa: true },
            include: { cobertura: true, plan: true },
            take: 1,
          },
        },
      }),
      prisma.paciente.count({ where }),
    ])
    return { data, total }
  })

  app.get('/:id', async (req, reply) => {
    const user = req.requirePermiso('paciente:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    const p = await prisma.paciente.findUnique({
      where: { id },
      include: {
        contactos: { orderBy: [{ prioritario: 'desc' }, { nombre: 'asc' }] },
        coberturas: { include: { cobertura: true, plan: true } },
        historia_clinica: { select: { id: true, numero: true, grupo_sanguineo: true, factor_rh: true } },
        _count: { select: { turnos: true, comprobantes: true } },
      },
    })
    if (!p) return notFound(reply, 'Paciente')
    await writeAudit({
      usuario_id: user.id,
      accion: 'VER',
      entidad: 'Paciente',
      entidad_id: id,
      ...auditMetaFromRequest(req),
    })
    return p
  })

  app.post('/', async (req, reply) => {
    const user = req.requirePermiso('paciente:crear', { flexible: true })
    const data = parseOrFail(pacienteSchema, req.body)
    const created = await prisma.$transaction(async (tx) => {
      const p = await tx.paciente.create({
        data: {
          ...data,
          fecha_nacimiento: data.fecha_nacimiento ? new Date(data.fecha_nacimiento) : null,
        },
      })
      await tx.historiaClinica.create({ data: { paciente_id: p.id } })
      return p
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Paciente',
      entidad_id: created.id,
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(created)
  })

  app.patch('/:id', async (req, reply) => {
    const user = req.requirePermiso('paciente:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(pacienteSchema.partial(), req.body)
    const existing = await prisma.paciente.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Paciente')
    const p = await prisma.paciente.update({
      where: { id },
      data: {
        ...data,
        fecha_nacimiento:
          data.fecha_nacimiento !== undefined
            ? data.fecha_nacimiento
              ? new Date(data.fecha_nacimiento)
              : null
            : undefined,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'Paciente',
      entidad_id: id,
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return p
  })

  app.delete('/:id', async (req, reply) => {
    const user = req.requirePermiso('paciente:eliminar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const motivo = (req.body as any)?.motivo as string | undefined
    const existing = await prisma.paciente.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Paciente')
    if (!motivo) {
      return reply.code(400).send({ error: 'Bad request', message: 'motivo requerido para soft-delete' })
    }
    // Renombramos DNI/email para liberar el unique al borrar
    const stamp = Date.now()
    await prisma.paciente.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: user.id,
        motivo_eliminacion: motivo,
        dni: `${existing.dni}-DEL-${stamp}`,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'ELIMINAR',
      entidad: 'Paciente',
      entidad_id: id,
      descripcion: motivo,
      ...auditMetaFromRequest(req),
    })
    return reply.code(204).send()
  })

  // ── Contactos de emergencia ───────────────────────────────────
  app.get('/:id/contactos', async (req) => {
    req.requirePermiso('paciente:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    return prisma.contactoEmergencia.findMany({
      where: { paciente_id: id },
      orderBy: [{ prioritario: 'desc' }, { nombre: 'asc' }],
    })
  })
  app.post('/contactos', async (req, reply) => {
    req.requirePermiso('paciente:editar', { flexible: true })
    const data = parseOrFail(contactoSchema, req.body)
    const c = await prisma.contactoEmergencia.create({ data })
    return reply.code(201).send(c)
  })
  app.delete('/contactos/:id', async (req, reply) => {
    req.requirePermiso('paciente:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    await prisma.contactoEmergencia.delete({ where: { id } })
    return reply.code(204).send()
  })

  // ── Afiliaciones / coberturas del paciente ─────────────────────
  app.get('/:id/coberturas', async (req) => {
    req.requirePermiso('paciente:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    return prisma.pacienteCobertura.findMany({
      where: { paciente_id: id },
      include: { cobertura: true, plan: true },
      orderBy: [{ principal: 'desc' }, { created_at: 'desc' }],
    })
  })
  app.post('/:id/coberturas', async (req, reply) => {
    const user = req.requirePermiso('paciente:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(afiliacionSchema, req.body)
    if (data.principal) {
      await prisma.pacienteCobertura.updateMany({
        where: { paciente_id: id, principal: true },
        data: { principal: false },
      })
    }
    const c = await prisma.pacienteCobertura.create({
      data: {
        paciente_id: id,
        cobertura_id: data.cobertura_id,
        plan_id: data.plan_id ?? null,
        numero_afiliado: data.numero_afiliado,
        vigencia_desde: data.vigencia_desde ? new Date(data.vigencia_desde) : null,
        vigencia_hasta: data.vigencia_hasta ? new Date(data.vigencia_hasta) : null,
        principal: data.principal ?? true,
        activa: data.activa ?? true,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'PacienteCobertura',
      entidad_id: c.id,
      contexto: { paciente_id: id },
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(c)
  })
}
