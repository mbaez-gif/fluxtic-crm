import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'
import { dispararEventoN8n } from '../lib/n8n'

const estadoEnum = z.enum([
  'PENDIENTE',
  'CONFIRMADO',
  'EN_SALA_ESPERA',
  'EN_ATENCION',
  'ATENDIDO',
  'CANCELADO',
  'AUSENTE',
])

const modalidadEnum = z.enum(['PRESENCIAL', 'VIRTUAL'])

const createSchema = z.object({
  paciente_id: z.string(),
  profesional_id: z.string(),
  prestacion_id: z.string().nullable().optional(),
  sede_id: z.string(),
  consultorio_id: z.string().nullable().optional(),
  fecha_hora: z.string().datetime(),
  duracion_min: z.number().int().positive().optional(),
  modalidad: modalidadEnum.optional(),
  sobreturno: z.boolean().optional(),
  lista_espera: z.boolean().optional(),
  motivo_consulta: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
})

const updateSchema = createSchema.partial()

// Transiciones validas de estado
const TRANSICIONES: Record<string, string[]> = {
  PENDIENTE:      ['CONFIRMADO', 'CANCELADO', 'AUSENTE'],
  CONFIRMADO:     ['EN_SALA_ESPERA', 'CANCELADO', 'AUSENTE'],
  EN_SALA_ESPERA: ['EN_ATENCION', 'CANCELADO', 'AUSENTE'],
  EN_ATENCION:    ['ATENDIDO'],
  ATENDIDO:       [],
  CANCELADO:      [],
  AUSENTE:        [],
}

export async function turnosRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requirePermiso('agenda:ver', { flexible: true })
    const q = (req.query as any) ?? {}
    const where: any = {}
    if (q.profesional_id) where.profesional_id = q.profesional_id
    if (q.sede_id) where.sede_id = q.sede_id
    if (q.paciente_id) where.paciente_id = q.paciente_id
    if (q.estado) where.estado = q.estado
    if (q.desde || q.hasta) {
      where.fecha_hora = {}
      if (q.desde) where.fecha_hora.gte = new Date(q.desde)
      if (q.hasta) where.fecha_hora.lte = new Date(q.hasta)
    }
    // Si es medico, restringir a sus propios turnos (scope ver_propia)
    const user = req.user
    if (user?.rol === 'MEDICO' && user.perfil_profesional_id) {
      where.profesional_id = user.perfil_profesional_id
    }
    return prisma.turno.findMany({
      where,
      include: {
        paciente: { select: { id: true, nombre: true, apellido: true, dni: true, telefono: true } },
        profesional: { include: { usuario: { select: { nombre: true, apellido: true } }, especialidad: true } },
        prestacion: { select: { id: true, nombre: true, duracion_min: true } },
        sede: { select: { id: true, nombre: true } },
        consultorio: { select: { id: true, nombre: true, numero: true } },
      },
      orderBy: { fecha_hora: 'asc' },
    })
  })

  app.get('/:id', async (req, reply) => {
    req.requirePermiso('agenda:ver', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const t = await prisma.turno.findUnique({
      where: { id },
      include: {
        paciente: true,
        profesional: { include: { usuario: true, especialidad: true } },
        prestacion: true,
        sede: true,
        consultorio: true,
        comprobantes: { select: { id: true, numero: true, total: true, estado: true } },
        cambios_estado: { orderBy: { created_at: 'desc' } },
      },
    })
    if (!t) return notFound(reply, 'Turno')
    return t
  })

  app.post('/', async (req, reply) => {
    const user = req.requirePermiso('turno:crear', { flexible: true })
    const data = parseOrFail(createSchema, req.body)
    const fecha = new Date(data.fecha_hora)
    const duracion = data.duracion_min ?? 30

    // Validar superposicion (salvo sobreturno)
    if (!data.sobreturno && !data.lista_espera) {
      const fin = new Date(fecha.getTime() + duracion * 60000)
      const conflicto = await prisma.turno.findFirst({
        where: {
          profesional_id: data.profesional_id,
          estado: { in: ['PENDIENTE', 'CONFIRMADO', 'EN_SALA_ESPERA', 'EN_ATENCION'] },
          fecha_hora: { lt: fin },
        },
      })
      if (conflicto) {
        const conflFin = new Date(conflicto.fecha_hora.getTime() + conflicto.duracion_min * 60000)
        if (conflFin > fecha) {
          return reply.code(409).send({
            error: 'Conflict',
            message: 'Slot ocupado por otro turno. Activa sobreturno o lista_espera para forzar.',
            conflicto_id: conflicto.id,
          })
        }
      }
    }

    const t = await prisma.turno.create({
      data: {
        paciente_id: data.paciente_id,
        profesional_id: data.profesional_id,
        prestacion_id: data.prestacion_id ?? null,
        sede_id: data.sede_id,
        consultorio_id: data.consultorio_id ?? null,
        fecha_hora: fecha,
        duracion_min: duracion,
        modalidad: data.modalidad ?? 'PRESENCIAL',
        sobreturno: data.sobreturno ?? false,
        lista_espera: data.lista_espera ?? false,
        motivo_consulta: data.motivo_consulta ?? null,
        observaciones: data.observaciones ?? null,
        creado_por_id: user.id,
      },
    })
    await prisma.cambioEstadoTurno.create({
      data: { turno_id: t.id, estado_nuevo: 'PENDIENTE', usuario_id: user.id },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Turno',
      entidad_id: t.id,
      contexto: { paciente_id: data.paciente_id },
      diff: data,
      ...auditMetaFromRequest(req),
    })

    // Disparar evento a n8n (workflow de confirmación al paciente)
    dispararEventoN8n('turno-creado', {
      turno_id: t.id,
      paciente_id: data.paciente_id,
      profesional_id: data.profesional_id,
      sede_id: data.sede_id,
      fecha_hora: t.fecha_hora.toISOString(),
      modalidad: t.modalidad,
      origen: 'ADMIN',
    }).catch(() => {})

    return reply.code(201).send(t)
  })

  app.patch('/:id', async (req, reply) => {
    const user = req.requirePermiso('turno:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const data = parseOrFail(updateSchema, req.body)
    const existing = await prisma.turno.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Turno')
    const t = await prisma.turno.update({
      where: { id },
      data: {
        ...data,
        fecha_hora: data.fecha_hora ? new Date(data.fecha_hora) : undefined,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'Turno',
      entidad_id: id,
      diff: data,
      ...auditMetaFromRequest(req),
    })
    return t
  })

  app.post('/:id/estado', async (req, reply) => {
    const user = req.requirePermiso('turno:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const body = parseOrFail(
      z.object({ estado: estadoEnum, motivo: z.string().optional() }),
      req.body,
    )
    const t = await prisma.turno.findUnique({ where: { id } })
    if (!t) return notFound(reply, 'Turno')
    const validos = TRANSICIONES[t.estado] ?? []
    if (!validos.includes(body.estado)) {
      return reply.code(400).send({
        error: 'Bad request',
        message: `Transicion invalida ${t.estado} -> ${body.estado}. Validas: ${validos.join(', ') || '(ninguna)'}`,
      })
    }
    const now = new Date()
    const updates: any = { estado: body.estado }
    if (body.estado === 'EN_SALA_ESPERA') updates.ingreso_sala_at = now
    if (body.estado === 'EN_ATENCION') updates.inicio_atencion_at = now
    if (body.estado === 'ATENDIDO') updates.fin_atencion_at = now
    if (body.estado === 'CANCELADO') {
      updates.cancelado_at = now
      updates.cancelado_motivo = body.motivo ?? null
    }
    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.turno.update({ where: { id }, data: updates })
      await tx.cambioEstadoTurno.create({
        data: {
          turno_id: id,
          estado_anterior: t.estado,
          estado_nuevo: body.estado,
          usuario_id: user.id,
          motivo: body.motivo ?? null,
        },
      })
      return r
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'Turno',
      entidad_id: id,
      descripcion: `${t.estado} -> ${body.estado}`,
      diff: { estado: body.estado, motivo: body.motivo },
      ...auditMetaFromRequest(req),
    })

    // Eventos n8n por transición de estado
    if (body.estado === 'CONFIRMADO') {
      dispararEventoN8n('turno-confirmado', { turno_id: id, estado_previo: t.estado }).catch(() => {})
    } else if (body.estado === 'CANCELADO') {
      dispararEventoN8n('turno-cancelado', { turno_id: id, estado_previo: t.estado, motivo: body.motivo }).catch(() => {})
    } else if (body.estado === 'AUSENTE') {
      dispararEventoN8n('turno-no-show', { turno_id: id }).catch(() => {})
    } else if (body.estado === 'ATENDIDO') {
      dispararEventoN8n('turno-atendido', { turno_id: id, paciente_id: t.paciente_id }).catch(() => {})
    }

    return updated
  })

  app.delete('/:id', async (req, reply) => {
    const user = req.requirePermiso('turno:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const motivo = (req.body as any)?.motivo ?? 'Eliminado'
    const existing = await prisma.turno.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Turno')
    await prisma.turno.update({
      where: { id },
      data: { deleted_at: new Date(), deleted_by: user.id, motivo_eliminacion: motivo },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'ELIMINAR',
      entidad: 'Turno',
      entidad_id: id,
      descripcion: motivo,
      ...auditMetaFromRequest(req),
    })
    return reply.code(204).send()
  })
}
