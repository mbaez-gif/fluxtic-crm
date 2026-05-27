/**
 * Comunicaciones con pacientes:
 *  - Listar comunicaciones enviadas / pendientes
 *  - Plantillas de mensajes
 *  - Endpoints consumidos por n8n para cron de recordatorios y cumpleaños
 *  - Log de envío que actualiza flags en Turno
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const canalEnum = z.enum(['WHATSAPP', 'EMAIL', 'SMS'])
const tipoComEnum = z.enum([
  'CONFIRMACION_TURNO',
  'RECORDATORIO_48H',
  'RECORDATORIO_24H',
  'RECORDATORIO_2H',
  'PREPARACION_PREVIA',
  'POSTCONSULTA',
  'SEGUIMIENTO',
  'REACTIVACION',
  'PAGO_PENDIENTE',
  'CONFIRMACION_PAGO',
  'CAMPANIA',
  'OTRO',
])

const plantillaSchema = z.object({
  codigo: z.string().min(1),
  canal: canalEnum,
  tipo: tipoComEnum,
  asunto: z.string().nullable().optional(),
  cuerpo: z.string().min(1),
  variables: z.array(z.string()).optional(),
  activa: z.boolean().optional(),
})

const logSchema = z.object({
  paciente_id: z.string(),
  turno_id: z.string().nullable().optional(),
  canal: canalEnum,
  tipo: tipoComEnum,
  destino: z.string().min(1),
  cuerpo: z.string().min(1),
  asunto: z.string().nullable().optional(),
  external_id: z.string().nullable().optional(),
  estado: z.enum(['PENDIENTE', 'ENVIADA', 'ENTREGADA', 'LEIDA', 'RESPONDIDA', 'FALLIDA']).optional(),
  error: z.string().nullable().optional(),
})

export async function comunicacionesRoutes(app: FastifyInstance) {
  // ── Listado ──────────────────────────────────────────────────
  app.get('/', async (request) => {
    request.requirePermiso('comunicacion:ver')
    const q = (request.query as any) ?? {}
    const where: any = {}
    if (q.paciente_id) where.paciente_id = q.paciente_id
    if (q.turno_id) where.turno_id = q.turno_id
    if (q.tipo) where.tipo = q.tipo
    if (q.canal) where.canal = q.canal
    if (q.estado) where.estado = q.estado
    const take = Math.min(parseInt(q.limit ?? '50', 10), 200)
    const [data, total] = await Promise.all([
      prisma.comunicacionPaciente.findMany({
        where,
        include: { paciente: { select: { id: true, nombre: true, apellido: true } } },
        orderBy: { created_at: 'desc' },
        take,
      }),
      prisma.comunicacionPaciente.count({ where }),
    ])
    return { data, total }
  })

  // ── Plantillas ───────────────────────────────────────────────
  app.get('/plantillas', async (request) => {
    request.requireAuth()
    return prisma.plantillaMensaje.findMany({ orderBy: { codigo: 'asc' } })
  })

  app.post('/plantillas', async (request, reply) => {
    const user = request.requirePermiso('comunicacion:crear')
    const data = parseOrFail(plantillaSchema, request.body)
    const p = await prisma.plantillaMensaje.create({
      data: {
        ...data,
        variables: data.variables ? JSON.stringify(data.variables) : null,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'PlantillaMensaje',
      entidad_id: p.id,
      ...auditMetaFromRequest(request),
    })
    return reply.code(201).send(p)
  })

  app.patch('/plantillas/:id', async (request, reply) => {
    const user = request.requirePermiso('comunicacion:crear')
    const { id } = parseOrFail(idParamSchema, request.params)
    const data = parseOrFail(plantillaSchema.partial(), request.body)
    const p = await prisma.plantillaMensaje.update({
      where: { id },
      data: {
        ...data,
        variables: data.variables ? JSON.stringify(data.variables) : undefined,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'PlantillaMensaje',
      entidad_id: id,
      ...auditMetaFromRequest(request),
    })
    return p
  })

  // ── Crear / loggear comunicación ─────────────────────────────
  app.post('/log', async (request, reply) => {
    const data = parseOrFail(logSchema, request.body)
    const com = await prisma.comunicacionPaciente.create({
      data: {
        paciente_id: data.paciente_id,
        turno_id: data.turno_id ?? null,
        canal: data.canal,
        tipo: data.tipo,
        destino: data.destino,
        asunto: data.asunto ?? null,
        cuerpo: data.cuerpo,
        estado: data.estado ?? (data.error ? 'FALLIDA' : 'ENVIADA'),
        enviada_at: data.estado !== 'PENDIENTE' ? new Date() : null,
        external_id: data.external_id ?? null,
        error_mensaje: data.error ?? null,
      },
    })

    // Si es recordatorio + turno_id, actualizar flag del turno
    if (data.turno_id && !data.error) {
      if (data.tipo === 'RECORDATORIO_48H') {
        await prisma.turno.update({ where: { id: data.turno_id }, data: { recordatorio_48h_enviado: true } })
      } else if (data.tipo === 'RECORDATORIO_24H') {
        await prisma.turno.update({ where: { id: data.turno_id }, data: { recordatorio_24h_enviado: true } })
      } else if (data.tipo === 'RECORDATORIO_2H') {
        await prisma.turno.update({ where: { id: data.turno_id }, data: { recordatorio_2h_enviado: true } })
      }
    }

    return reply.code(201).send(com)
  })

  // ── Endpoints para crons n8n ─────────────────────────────────
  // GET /comunicaciones/turnos-proximos?ventana=48h|24h|2h
  app.get('/turnos-proximos', async (request) => {
    const q = (request.query as any) ?? {}
    const ventana = (q.ventana as '48h' | '24h' | '2h') ?? '24h'
    const horas = ventana === '48h' ? 48 : ventana === '24h' ? 24 : 2
    const ahora = new Date()
    const desde = new Date(ahora.getTime() + Math.max(0, horas - 1) * 3600 * 1000)
    const hasta = new Date(ahora.getTime() + horas * 3600 * 1000)

    const campoFlag =
      ventana === '48h' ? 'recordatorio_48h_enviado'
        : ventana === '24h' ? 'recordatorio_24h_enviado'
          : 'recordatorio_2h_enviado'

    const turnos = await prisma.turno.findMany({
      where: {
        fecha_hora: { gte: desde, lte: hasta },
        estado: { in: ['PENDIENTE', 'CONFIRMADO'] },
        [campoFlag]: false,
        paciente: { telefono: { not: null } },
      } as any,
      include: {
        paciente: { select: { id: true, nombre: true, apellido: true, telefono: true, dni: true } },
        profesional: { include: { usuario: { select: { nombre: true, apellido: true } }, especialidad: true } },
        prestacion: { select: { nombre: true, instrucciones_preparacion: true, requiere_preparacion: true } },
        sede: { select: { nombre: true, direccion: true } },
        consultorio: { select: { nombre: true, numero: true } },
      },
      orderBy: { fecha_hora: 'asc' },
    })

    return {
      ventana,
      data: turnos.map((t) => ({
        turno_id: t.id,
        paciente_id: t.paciente.id,
        paciente_nombre: `${t.paciente.nombre} ${t.paciente.apellido}`.trim(),
        paciente_telefono: t.paciente.telefono,
        paciente_dni: t.paciente.dni,
        profesional: `${t.profesional.usuario.apellido}, ${t.profesional.usuario.nombre}`,
        especialidad: t.profesional.especialidad.nombre,
        prestacion: t.prestacion?.nombre ?? null,
        requiere_preparacion: t.prestacion?.requiere_preparacion ?? false,
        instrucciones_preparacion: t.prestacion?.instrucciones_preparacion ?? null,
        sede: t.sede.nombre,
        sede_direccion: t.sede.direccion,
        consultorio: t.consultorio?.nombre ?? null,
        fecha: t.fecha_hora.toISOString().split('T')[0],
        hora: t.fecha_hora.toTimeString().slice(0, 5),
        modalidad: t.modalidad,
      })),
      total: turnos.length,
    }
  })

  // GET /comunicaciones/postconsulta-pendientes — n8n cron 30 min
  app.get('/postconsulta-pendientes', async () => {
    const hace2h = new Date(Date.now() - 2 * 3600 * 1000)
    const hace12h = new Date(Date.now() - 12 * 3600 * 1000)

    const turnos = await prisma.turno.findMany({
      where: {
        estado: 'ATENDIDO',
        fin_atencion_at: { gte: hace12h, lte: hace2h },
        comunicaciones: { none: { tipo: 'POSTCONSULTA' } },
        paciente: { telefono: { not: null } },
      },
      include: {
        paciente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
        profesional: { include: { usuario: { select: { nombre: true, apellido: true } } } },
        prestacion: { select: { nombre: true } },
      },
      orderBy: { fin_atencion_at: 'asc' },
      take: 50,
    })

    return {
      data: turnos.map((t) => ({
        turno_id: t.id,
        paciente_id: t.paciente.id,
        paciente_nombre: `${t.paciente.nombre} ${t.paciente.apellido}`.trim(),
        paciente_telefono: t.paciente.telefono,
        profesional: `${t.profesional.usuario.apellido}, ${t.profesional.usuario.nombre}`,
        prestacion: t.prestacion?.nombre ?? null,
      })),
      total: turnos.length,
    }
  })

  // GET /comunicaciones/inactivos-reactivacion?dias=90 — campaña de reactivación
  app.get('/inactivos-reactivacion', async (request) => {
    const q = (request.query as any) ?? {}
    const dias = parseInt(q.dias ?? '90', 10)
    const limite = new Date(Date.now() - dias * 24 * 3600 * 1000)
    const inactivos = await prisma.paciente.findMany({
      where: {
        estado: 'ACTIVO',
        telefono: { not: null },
        turnos: { every: { fecha_hora: { lt: limite } } },
        comunicaciones: { none: { tipo: 'REACTIVACION', created_at: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) } } },
      },
      select: { id: true, nombre: true, apellido: true, telefono: true },
      take: 100,
    })
    return { data: inactivos, total: inactivos.length, dias }
  })
}
