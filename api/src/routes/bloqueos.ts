/**
 * Bloqueos de agenda:
 *  - Día completo (cierra la clínica un día específico)
 *  - Rango horario (ej. reunión de staff de 14 a 16)
 *  - Por profesional (vacaciones, licencia)
 *  - Por sede / consultorio
 *
 * Al crear con cancela_turnos=true, marca los turnos afectados como CANCELADO
 * y dispara evento n8n para que el workflow avise a los pacientes.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { dispararEventoN8n } from '../lib/n8n'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const tipoEnum = z.enum(['DIA_COMPLETO', 'RANGO_HORARIO', 'PROFESIONAL', 'SEDE', 'CONSULTORIO'])

const bloqueoSchema = z.object({
  tipo: tipoEnum,
  desde: z.string().datetime(),
  hasta: z.string().datetime(),
  profesional_id: z.string().nullable().optional(),
  sede_id: z.string().nullable().optional(),
  consultorio_id: z.string().nullable().optional(),
  motivo: z.string().min(1),
  cancela_turnos: z.boolean().optional(),
})

export async function bloqueosRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    request.requirePermiso('agenda:ver', { flexible: true })
    const q = (request.query as any) ?? {}
    const where: any = {}
    if (q.profesional_id) where.profesional_id = q.profesional_id
    if (q.sede_id) where.sede_id = q.sede_id
    if (q.desde || q.hasta) {
      where.AND = []
      if (q.desde) where.AND.push({ hasta: { gte: new Date(q.desde) } })
      if (q.hasta) where.AND.push({ desde: { lte: new Date(q.hasta) } })
    }
    return prisma.bloqueoAgenda.findMany({
      where,
      include: {
        profesional: { include: { usuario: { select: { nombre: true, apellido: true } } } },
        sede: { select: { id: true, nombre: true } },
        consultorio: { select: { id: true, nombre: true } },
      },
      orderBy: { desde: 'asc' },
    })
  })

  app.post('/', async (request, reply) => {
    const user = request.requirePermiso('agenda:editar', { flexible: true })
    const data = parseOrFail(bloqueoSchema, request.body)
    const desde = new Date(data.desde)
    const hasta = new Date(data.hasta)
    if (hasta <= desde) {
      return reply.code(400).send({ error: 'Bad request', message: 'hasta debe ser posterior a desde' })
    }

    // Validar coherencia: si tipo=PROFESIONAL exige profesional_id, etc.
    if (data.tipo === 'PROFESIONAL' && !data.profesional_id) {
      return reply.code(400).send({ error: 'Bad request', message: 'profesional_id requerido para tipo PROFESIONAL' })
    }
    if (data.tipo === 'SEDE' && !data.sede_id) {
      return reply.code(400).send({ error: 'Bad request', message: 'sede_id requerido para tipo SEDE' })
    }
    if (data.tipo === 'CONSULTORIO' && !data.consultorio_id) {
      return reply.code(400).send({ error: 'Bad request', message: 'consultorio_id requerido para tipo CONSULTORIO' })
    }

    // Crear bloqueo + (si cancela_turnos) cancelar los turnos afectados
    const result = await prisma.$transaction(async (tx) => {
      const bloq = await tx.bloqueoAgenda.create({
        data: {
          tipo: data.tipo,
          desde,
          hasta,
          profesional_id: data.profesional_id ?? null,
          sede_id: data.sede_id ?? null,
          consultorio_id: data.consultorio_id ?? null,
          motivo: data.motivo,
          cancela_turnos: data.cancela_turnos ?? false,
          creado_por_id: user.id,
        },
      })

      let turnosCancelados = 0
      const turnosAfectadosIds: string[] = []
      if (data.cancela_turnos) {
        const whereTurnos: any = {
          fecha_hora: { gte: desde, lt: hasta },
          estado: { in: ['PENDIENTE', 'CONFIRMADO', 'PENDIENTE_PAGO_MP', 'PENDIENTE_VALIDACION_MANUAL', 'EN_SALA_ESPERA'] },
        }
        if (data.profesional_id) whereTurnos.profesional_id = data.profesional_id
        if (data.sede_id) whereTurnos.sede_id = data.sede_id
        if (data.consultorio_id) whereTurnos.consultorio_id = data.consultorio_id

        const afectados = await tx.turno.findMany({ where: whereTurnos, select: { id: true } })
        turnosAfectadosIds.push(...afectados.map((t) => t.id))

        if (afectados.length > 0) {
          await tx.turno.updateMany({
            where: { id: { in: turnosAfectadosIds } },
            data: {
              estado: 'CANCELADO',
              cancelado_at: new Date(),
              cancelado_motivo: `Bloqueo: ${data.motivo}`,
            },
          })
          for (const id of turnosAfectadosIds) {
            await tx.cambioEstadoTurno.create({
              data: {
                turno_id: id,
                estado_nuevo: 'CANCELADO',
                usuario_id: user.id,
                motivo: `Bloqueo de agenda: ${data.motivo}`,
              },
            })
          }
          turnosCancelados = afectados.length
          await tx.bloqueoAgenda.update({
            where: { id: bloq.id },
            data: { turnos_cancelados: turnosCancelados },
          })
        }
      }

      return { bloqueo: bloq, turnosCancelados, turnosAfectadosIds }
    })

    // Disparar evento n8n para que el workflow avise a los pacientes
    if (result.turnosAfectadosIds.length > 0) {
      dispararEventoN8n('turnos-cancelados-por-bloqueo', {
        bloqueo_id: result.bloqueo.id,
        motivo: data.motivo,
        turnos_ids: result.turnosAfectadosIds,
      }).catch(() => {})
    }

    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'BloqueoAgenda',
      entidad_id: result.bloqueo.id,
      diff: { ...data, turnos_cancelados: result.turnosCancelados },
      ...auditMetaFromRequest(request),
    })

    return reply.code(201).send({ ...result.bloqueo, turnos_cancelados: result.turnosCancelados })
  })

  app.delete('/:id', async (request, reply) => {
    const user = request.requirePermiso('agenda:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, request.params)
    const existing = await prisma.bloqueoAgenda.findUnique({ where: { id } })
    if (!existing) return notFound(reply, 'Bloqueo')
    await prisma.bloqueoAgenda.delete({ where: { id } })
    await writeAudit({
      usuario_id: user.id,
      accion: 'ELIMINAR',
      entidad: 'BloqueoAgenda',
      entidad_id: id,
      ...auditMetaFromRequest(request),
    })
    return reply.code(204).send()
  })
}
