import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const tipoAntecedente = z.enum([
  'PERSONAL',
  'FAMILIAR',
  'QUIRURGICO',
  'OBSTETRICO',
  'GINECOLOGICO',
  'TRAUMATICO',
  'OTRO',
])
const severidad = z.enum(['LEVE', 'MODERADA', 'SEVERA', 'CRITICA'])

const evolucionSchema = z.object({
  paciente_id: z.string(),
  turno_id: z.string().nullable().optional(),
  profesional_id: z.string(),
  motivo_consulta: z.string().nullable().optional(),
  subjetivo: z.string().nullable().optional(),
  objetivo: z.string().nullable().optional(),
  analisis: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
  texto_libre: z.string().nullable().optional(),
})

const antecedenteSchema = z.object({
  paciente_id: z.string(),
  tipo: tipoAntecedente,
  descripcion: z.string().min(1),
  fecha: z.string().datetime().nullable().optional(),
  cie10: z.string().nullable().optional(),
})

const alergiaSchema = z.object({
  paciente_id: z.string(),
  sustancia: z.string().min(1),
  severidad: severidad.optional(),
  reaccion: z.string().nullable().optional(),
  fecha_inicio: z.string().datetime().nullable().optional(),
})

const medicacionSchema = z.object({
  paciente_id: z.string(),
  medicamento: z.string().min(1),
  dosis: z.string().nullable().optional(),
  frecuencia: z.string().nullable().optional(),
  via: z.string().nullable().optional(),
  desde: z.string().datetime().nullable().optional(),
  hasta: z.string().datetime().nullable().optional(),
  motivo: z.string().nullable().optional(),
})

const diagnosticoSchema = z.object({
  paciente_id: z.string(),
  evolucion_id: z.string().nullable().optional(),
  cie10: z.string().nullable().optional(),
  descripcion: z.string().min(1),
})

const indicacionSchema = z.object({
  paciente_id: z.string(),
  evolucion_id: z.string().nullable().optional(),
  texto: z.string().min(1),
  visible_paciente: z.boolean().optional(),
})

async function getOrCreateHC(paciente_id: string) {
  const hc = await prisma.historiaClinica.findUnique({ where: { paciente_id } })
  if (hc) return hc
  return prisma.historiaClinica.create({ data: { paciente_id } })
}

export async function historiaClinicaRoutes(app: FastifyInstance) {
  // Ficha completa de HC
  app.get('/paciente/:id', async (req, reply) => {
    const user = req.requirePermiso('hc:ver', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    const paciente = await prisma.paciente.findUnique({ where: { id } })
    if (!paciente) return notFound(reply, 'Paciente')

    const hc = await getOrCreateHC(id)
    const [evoluciones, antecedentes, alergias, medicaciones, diagnosticos, indicaciones] = await Promise.all([
      prisma.evolucionClinica.findMany({
        where: { historia_id: hc.id },
        orderBy: { fecha: 'desc' },
        include: { profesional: { include: { usuario: { select: { nombre: true, apellido: true } }, especialidad: true } } },
        take: 50,
      }),
      prisma.antecedente.findMany({ where: { historia_id: hc.id, activo: true }, orderBy: { created_at: 'desc' } }),
      prisma.alergia.findMany({ where: { historia_id: hc.id, activa: true }, orderBy: { severidad: 'desc' } }),
      prisma.medicacionHabitual.findMany({ where: { historia_id: hc.id, activa: true }, orderBy: { created_at: 'desc' } }),
      prisma.diagnostico.findMany({ where: { historia_id: hc.id, activo: true }, orderBy: { fecha: 'desc' } }),
      prisma.indicacion.findMany({ where: { historia_id: hc.id }, orderBy: { fecha: 'desc' }, take: 30 }),
    ])

    await writeAudit({
      usuario_id: user.id,
      accion: 'VER',
      entidad: 'HistoriaClinica',
      entidad_id: hc.id,
      contexto: { paciente_id: id },
      ...auditMetaFromRequest(req),
    })

    return {
      historia: hc,
      paciente: { id: paciente.id, nombre: paciente.nombre, apellido: paciente.apellido, dni: paciente.dni },
      evoluciones,
      antecedentes,
      alergias,
      medicaciones,
      diagnosticos,
      indicaciones,
    }
  })

  // ── Evoluciones ───────────────────────────────────────────────
  app.post('/evoluciones', async (req, reply) => {
    const user = req.requirePermiso('evolucion:crear')
    const data = parseOrFail(evolucionSchema, req.body)
    const hc = await getOrCreateHC(data.paciente_id)
    const e = await prisma.evolucionClinica.create({
      data: {
        historia_id: hc.id,
        turno_id: data.turno_id ?? null,
        profesional_id: data.profesional_id,
        usuario_id: user.id,
        motivo_consulta: data.motivo_consulta ?? null,
        subjetivo: data.subjetivo ?? null,
        objetivo: data.objetivo ?? null,
        analisis: data.analisis ?? null,
        plan: data.plan ?? null,
        texto_libre: data.texto_libre ?? null,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'EvolucionClinica',
      entidad_id: e.id,
      contexto: { paciente_id: data.paciente_id, historia_id: hc.id },
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(e)
  })

  app.post('/evoluciones/:id/firmar', async (req, reply) => {
    const user = req.requirePermiso('evolucion:editar', { flexible: true })
    const { id } = parseOrFail(idParamSchema, req.params)
    if (!user.perfil_profesional_id) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Solo profesionales pueden firmar' })
    }
    const e = await prisma.evolucionClinica.update({
      where: { id },
      data: { firmado_at: new Date(), firmado_por_id: user.perfil_profesional_id },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'FIRMAR',
      entidad: 'EvolucionClinica',
      entidad_id: id,
      ...auditMetaFromRequest(req),
    })
    return e
  })

  // ── Antecedentes ──────────────────────────────────────────────
  app.post('/antecedentes', async (req, reply) => {
    const user = req.requirePermiso('antecedente:crear')
    const data = parseOrFail(antecedenteSchema, req.body)
    const hc = await getOrCreateHC(data.paciente_id)
    const a = await prisma.antecedente.create({
      data: {
        historia_id: hc.id,
        tipo: data.tipo,
        descripcion: data.descripcion,
        fecha: data.fecha ? new Date(data.fecha) : null,
        cie10: data.cie10 ?? null,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Antecedente',
      entidad_id: a.id,
      contexto: { paciente_id: data.paciente_id, historia_id: hc.id },
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(a)
  })

  // ── Alergias ──────────────────────────────────────────────────
  app.post('/alergias', async (req, reply) => {
    const user = req.requirePermiso('alergia:crear')
    const data = parseOrFail(alergiaSchema, req.body)
    const hc = await getOrCreateHC(data.paciente_id)
    const a = await prisma.alergia.create({
      data: {
        historia_id: hc.id,
        sustancia: data.sustancia,
        severidad: data.severidad ?? 'LEVE',
        reaccion: data.reaccion ?? null,
        fecha_inicio: data.fecha_inicio ? new Date(data.fecha_inicio) : null,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Alergia',
      entidad_id: a.id,
      contexto: { paciente_id: data.paciente_id },
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(a)
  })

  // ── Medicación habitual ───────────────────────────────────────
  app.post('/medicaciones', async (req, reply) => {
    const user = req.requirePermiso('medicacion:crear')
    const data = parseOrFail(medicacionSchema, req.body)
    const hc = await getOrCreateHC(data.paciente_id)
    const m = await prisma.medicacionHabitual.create({
      data: {
        historia_id: hc.id,
        medicamento: data.medicamento,
        dosis: data.dosis ?? null,
        frecuencia: data.frecuencia ?? null,
        via: data.via ?? null,
        desde: data.desde ? new Date(data.desde) : null,
        hasta: data.hasta ? new Date(data.hasta) : null,
        motivo: data.motivo ?? null,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'MedicacionHabitual',
      entidad_id: m.id,
      contexto: { paciente_id: data.paciente_id },
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(m)
  })

  // ── Diagnósticos ──────────────────────────────────────────────
  app.post('/diagnosticos', async (req, reply) => {
    const user = req.requirePermiso('diagnostico:crear')
    const data = parseOrFail(diagnosticoSchema, req.body)
    const hc = await getOrCreateHC(data.paciente_id)
    const d = await prisma.diagnostico.create({
      data: {
        historia_id: hc.id,
        evolucion_id: data.evolucion_id ?? null,
        cie10: data.cie10 ?? null,
        descripcion: data.descripcion,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Diagnostico',
      entidad_id: d.id,
      contexto: { paciente_id: data.paciente_id },
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(d)
  })

  // ── Indicaciones ──────────────────────────────────────────────
  app.post('/indicaciones', async (req, reply) => {
    const user = req.requirePermiso('indicacion:crear')
    const data = parseOrFail(indicacionSchema, req.body)
    const hc = await getOrCreateHC(data.paciente_id)
    const i = await prisma.indicacion.create({
      data: {
        historia_id: hc.id,
        evolucion_id: data.evolucion_id ?? null,
        usuario_id: user.id,
        texto: data.texto,
        visible_paciente: data.visible_paciente ?? true,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Indicacion',
      entidad_id: i.id,
      contexto: { paciente_id: data.paciente_id },
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(i)
  })

  // ── Soft delete genérico para entidades clínicas ──────────────
  const deletableEntities = new Set([
    'antecedente',
    'alergia',
    'medicacion',
    'diagnostico',
    'indicacion',
    'evolucion',
  ])
  const entityToModel: Record<string, keyof typeof prisma> = {
    antecedente: 'antecedente',
    alergia: 'alergia',
    medicacion: 'medicacionHabitual',
    diagnostico: 'diagnostico',
    indicacion: 'indicacion',
    evolucion: 'evolucionClinica',
  }
  app.delete('/:entity/:id', async (req, reply) => {
    const user = req.requireAuth()
    const params = parseOrFail(
      z.object({ entity: z.string(), id: z.string() }),
      req.params,
    )
    if (!deletableEntities.has(params.entity)) {
      return reply.code(404).send({ error: 'Not found', message: 'Entidad no soportada' })
    }
    const motivo = (req.body as any)?.motivo
    if (!motivo) {
      return reply.code(400).send({ error: 'Bad request', message: 'motivo requerido' })
    }
    const modelName = entityToModel[params.entity]
    const client: any = prisma as any
    await client[modelName].update({
      where: { id: params.id },
      data: { deleted_at: new Date(), deleted_by: user.id, motivo_eliminacion: motivo },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'ELIMINAR',
      entidad: params.entity,
      entidad_id: params.id,
      descripcion: motivo,
      ...auditMetaFromRequest(req),
    })
    return reply.code(204).send()
  })
}
