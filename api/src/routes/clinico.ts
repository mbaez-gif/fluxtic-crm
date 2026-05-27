/**
 * Endpoints clínicos varios: alertas clínicas, feriados, encuestas, plantillas HC.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const alertaSchema = z.object({
  paciente_id: z.string(),
  titulo: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  severidad: z.enum(['INFO', 'ADVERTENCIA', 'CRITICA']).optional(),
})

const feriadoSchema = z.object({
  fecha: z.string().datetime(),
  nombre: z.string().min(1),
  cierra_total: z.boolean().optional(),
  observaciones: z.string().nullable().optional(),
})

const encuestaSchema = z.object({
  paciente_id: z.string(),
  turno_id: z.string().nullable().optional(),
  profesional_id: z.string().nullable().optional(),
  canal_envio: z.string().nullable().optional(),
})

const respuestaEncuestaSchema = z.object({
  puntaje: z.number().int().min(1).max(10).optional(),
  nps_score: z.number().int().min(0).max(10).optional(),
  comentario: z.string().nullable().optional(),
  recomendaria: z.boolean().nullable().optional(),
})

const plantillaHcSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  especialidad_id: z.string().nullable().optional(),
  estructura: z.record(z.unknown()),
  texto_base: z.string().nullable().optional(),
  activa: z.boolean().optional(),
})

export async function clinicoRoutes(app: FastifyInstance) {
  // ── Alertas clínicas ─────────────────────────────────────────
  app.get('/alertas/paciente/:id', async (request) => {
    request.requirePermiso('paciente:ver')
    const { id } = parseOrFail(idParamSchema, request.params)
    return prisma.alertaClinica.findMany({
      where: { paciente_id: id, activa: true },
      orderBy: [{ severidad: 'desc' }, { created_at: 'desc' }],
    })
  })

  app.post('/alertas', async (request, reply) => {
    const user = request.requirePermiso('paciente:editar', { flexible: true })
    const data = parseOrFail(alertaSchema, request.body)
    const a = await prisma.alertaClinica.create({
      data: { ...data, creada_por_id: user.id, severidad: data.severidad ?? 'INFO' },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'AlertaClinica',
      entidad_id: a.id,
      contexto: { paciente_id: data.paciente_id, severidad: a.severidad },
      ...auditMetaFromRequest(request),
    })
    return reply.code(201).send(a)
  })

  app.delete('/alertas/:id', async (request, reply) => {
    const user = request.requirePermiso('paciente:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, request.params)
    await prisma.alertaClinica.update({ where: { id }, data: { activa: false } })
    await writeAudit({
      usuario_id: user.id,
      accion: 'ELIMINAR',
      entidad: 'AlertaClinica',
      entidad_id: id,
      ...auditMetaFromRequest(request),
    })
    return reply.code(204).send()
  })

  // ── Feriados ────────────────────────────────────────────────
  app.get('/feriados', async (request) => {
    request.requireAuth()
    const q = (request.query as any) ?? {}
    const where: any = {}
    if (q.anio) {
      const anio = parseInt(q.anio, 10)
      where.fecha = { gte: new Date(anio, 0, 1), lt: new Date(anio + 1, 0, 1) }
    }
    return prisma.feriadoClinica.findMany({ where, orderBy: { fecha: 'asc' } })
  })

  app.post('/feriados', async (request, reply) => {
    const user = request.requirePermiso('agenda:editar', { flexible: true })
    const data = parseOrFail(feriadoSchema, request.body)
    const f = await prisma.feriadoClinica.create({
      data: { ...data, fecha: new Date(data.fecha) },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'FeriadoClinica',
      entidad_id: f.id,
      ...auditMetaFromRequest(request),
    })
    return reply.code(201).send(f)
  })

  app.delete('/feriados/:id', async (request, reply) => {
    const user = request.requirePermiso('agenda:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, request.params)
    await prisma.feriadoClinica.delete({ where: { id } })
    await writeAudit({
      usuario_id: user.id,
      accion: 'ELIMINAR',
      entidad: 'FeriadoClinica',
      entidad_id: id,
      ...auditMetaFromRequest(request),
    })
    return reply.code(204).send()
  })

  // ── Encuestas de satisfacción ────────────────────────────────
  app.post('/encuestas', async (request, reply) => {
    request.requireAuth()
    const data = parseOrFail(encuestaSchema, request.body)
    const e = await prisma.encuestaSatisfaccion.create({ data })
    return reply.code(201).send(e)
  })

  // Endpoint público (sin auth) para que el paciente responda desde un link
  app.post('/encuestas/:id/responder', async (request, reply) => {
    const { id } = parseOrFail(idParamSchema, request.params)
    const data = parseOrFail(respuestaEncuestaSchema, request.body)
    const e = await prisma.encuestaSatisfaccion.findUnique({ where: { id } })
    if (!e) return notFound(reply, 'Encuesta')
    if (e.respondida_at) {
      return reply.code(400).send({ error: 'Bad request', message: 'Encuesta ya respondida' })
    }
    return prisma.encuestaSatisfaccion.update({
      where: { id },
      data: { ...data, respondida_at: new Date() },
    })
  })

  app.get('/encuestas/resumen', async (request) => {
    request.requirePermiso('reporte:ver')
    const q = (request.query as any) ?? {}
    const desde = q.desde ? new Date(q.desde) : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const respuestas = await prisma.encuestaSatisfaccion.findMany({
      where: { respondida_at: { not: null, gte: desde } },
      select: { puntaje: true, nps_score: true, recomendaria: true },
    })
    const total = respuestas.length
    const puntajeProm = total > 0 ? respuestas.filter((r) => r.puntaje != null).reduce((a, r) => a + (r.puntaje ?? 0), 0) / total : 0
    const npsProm = total > 0 ? respuestas.filter((r) => r.nps_score != null).reduce((a, r) => a + (r.nps_score ?? 0), 0) / total : 0
    const recomendariaCount = respuestas.filter((r) => r.recomendaria === true).length
    return {
      total_respuestas: total,
      puntaje_promedio: Math.round(puntajeProm * 10) / 10,
      nps_promedio: Math.round(npsProm * 10) / 10,
      tasa_recomendacion: total > 0 ? Math.round((recomendariaCount / total) * 100) : 0,
    }
  })

  // ── Plantillas de HC por especialidad ───────────────────────
  app.get('/plantillas-hc', async (request) => {
    request.requireAuth()
    const q = (request.query as any) ?? {}
    const where: any = { activa: true }
    if (q.especialidad_id) where.especialidad_id = q.especialidad_id
    const plantillas = await prisma.plantillaHistoriaClinica.findMany({
      where,
      orderBy: { nombre: 'asc' },
    })
    return plantillas.map((p) => ({
      ...p,
      estructura: JSON.parse(p.estructura),
    }))
  })

  app.post('/plantillas-hc', async (request, reply) => {
    const user = request.requirePermiso('hc:editar', { flexible: true })
    const data = parseOrFail(plantillaHcSchema, request.body)
    const p = await prisma.plantillaHistoriaClinica.create({
      data: {
        ...data,
        estructura: JSON.stringify(data.estructura),
        creada_por_id: user.id,
      },
    })
    return reply.code(201).send(p)
  })
}
