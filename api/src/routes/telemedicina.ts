/**
 * Telemedicina:
 *  - POST /telemedicina/turno/:id/generar-link
 *  - POST /telemedicina/turno/:id/iniciar
 *  - POST /telemedicina/turno/:id/finalizar
 *  - GET  /telemedicina/turno/:id/sala (datos para abrir la sala desde el frontend)
 */
import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { dispararEventoN8n } from '../lib/n8n'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'
import { generarLinkVideoconsulta } from '../services/telemedicina.service'

export async function telemedicinaRoutes(app: FastifyInstance) {
  app.post('/turno/:id/generar-link', async (request, reply) => {
    const user = request.requirePermiso('turno:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, request.params)
    const turno = await prisma.turno.findUnique({
      where: { id },
      include: { paciente: { select: { id: true, nombre: true, apellido: true, telefono: true, email: true } } },
    })
    if (!turno) return notFound(reply, 'Turno')
    if (turno.modalidad !== 'VIRTUAL') {
      return reply.code(400).send({ error: 'Bad request', message: 'El turno no es virtual' })
    }
    if (turno.videoconsulta_url) {
      return { url: turno.videoconsulta_url, room: turno.videoconsulta_room, proveedor: turno.videoconsulta_proveedor, ya_existia: true }
    }

    const link = generarLinkVideoconsulta(id)
    await prisma.turno.update({
      where: { id },
      data: {
        videoconsulta_url: link.url,
        videoconsulta_room: link.room,
        videoconsulta_proveedor: link.proveedor,
        videoconsulta_estado: 'PENDIENTE',
      },
    })

    // Disparar evento n8n para que envíe el link al paciente por WA
    dispararEventoN8n('videoconsulta-link-generado', {
      turno_id: id,
      paciente_id: turno.paciente.id,
      paciente_telefono: turno.paciente.telefono,
      url: link.url,
      fecha_hora: turno.fecha_hora.toISOString(),
    }).catch(() => {})

    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Videoconsulta',
      entidad_id: id,
      contexto: { paciente_id: turno.paciente.id, proveedor: link.proveedor },
      ...auditMetaFromRequest(request),
    })

    return { ...link, ya_existia: false }
  })

  app.post('/turno/:id/iniciar', async (request, reply) => {
    const user = request.requirePermiso('turno:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, request.params)
    const turno = await prisma.turno.findUnique({ where: { id } })
    if (!turno) return notFound(reply, 'Turno')
    if (!turno.videoconsulta_url) {
      return reply.code(400).send({ error: 'Bad request', message: 'No hay link generado para este turno' })
    }
    const actualizado = await prisma.turno.update({
      where: { id },
      data: {
        estado: 'EN_ATENCION',
        videoconsulta_estado: 'EN_CURSO',
        videoconsulta_inicio_at: new Date(),
        inicio_atencion_at: new Date(),
      },
    })
    await prisma.cambioEstadoTurno.create({
      data: { turno_id: id, estado_anterior: turno.estado, estado_nuevo: 'EN_ATENCION', usuario_id: user.id, motivo: 'Inicio de videoconsulta' },
    })
    return actualizado
  })

  app.post('/turno/:id/finalizar', async (request, reply) => {
    const user = request.requirePermiso('turno:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, request.params)
    const turno = await prisma.turno.findUnique({ where: { id } })
    if (!turno) return notFound(reply, 'Turno')
    const actualizado = await prisma.turno.update({
      where: { id },
      data: {
        estado: 'ATENDIDO',
        videoconsulta_estado: 'FINALIZADA',
        videoconsulta_fin_at: new Date(),
        fin_atencion_at: new Date(),
      },
    })
    await prisma.cambioEstadoTurno.create({
      data: { turno_id: id, estado_anterior: turno.estado, estado_nuevo: 'ATENDIDO', usuario_id: user.id, motivo: 'Fin de videoconsulta' },
    })
    return actualizado
  })

  app.get('/turno/:id/sala', async (request, reply) => {
    const user = request.requireAuth()
    const { id } = parseOrFail(idParamSchema, request.params)
    const turno = await prisma.turno.findUnique({
      where: { id },
      include: {
        paciente: { select: { id: true, nombre: true, apellido: true, dni: true } },
        profesional: { include: { usuario: { select: { nombre: true, apellido: true } }, especialidad: true } },
        prestacion: { select: { nombre: true } },
      },
    })
    if (!turno) return notFound(reply, 'Turno')

    // Solo el profesional, paciente, recepción o admin pueden ver la sala
    const esProfesional = user.perfil_profesional_id === turno.profesional_id
    const esPaciente = user.paciente_id === turno.paciente_id
    const esStaff = ['ADMIN_GENERAL', 'RECEPCION', 'COORDINADOR_MEDICO'].includes(user.rol)
    if (!esProfesional && !esPaciente && !esStaff) {
      return reply.code(403).send({ error: 'Forbidden' })
    }

    return {
      turno_id: turno.id,
      fecha_hora: turno.fecha_hora,
      estado: turno.estado,
      videoconsulta_estado: turno.videoconsulta_estado,
      videoconsulta_url: turno.videoconsulta_url,
      videoconsulta_proveedor: turno.videoconsulta_proveedor,
      paciente: turno.paciente,
      profesional: {
        nombre: `${turno.profesional.usuario.apellido}, ${turno.profesional.usuario.nombre}`,
        especialidad: turno.profesional.especialidad.nombre,
      },
      prestacion: turno.prestacion?.nombre ?? null,
    }
  })
}
