/**
 * Vademécum local + chequeo de interacciones / alergias.
 *
 * Arquitectura preparada para sincronizar con vademécum externo (Kairos, etc.)
 * vía `codigo_externo` y `external_id`.
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const medicamentoSchema = z.object({
  codigo_externo: z.string().nullable().optional(),
  nombre_comercial: z.string().min(1),
  principio_activo: z.string().min(1),
  laboratorio: z.string().nullable().optional(),
  presentacion: z.string().nullable().optional(),
  via_admin: z.string().nullable().optional(),
  prescripcion_requerida: z.boolean().optional(),
  activo: z.boolean().optional(),
  interacciones: z.array(z.object({
    principio: z.string(),
    severidad: z.enum(['LEVE', 'MODERADA', 'SEVERA']),
    descripcion: z.string().optional(),
  })).optional(),
  contraindicaciones: z.string().nullable().optional(),
})

export async function medicamentosRoutes(app: FastifyInstance) {
  // Búsqueda autocompletar para form de receta
  app.get('/', async (request) => {
    request.requireAuth()
    const q = (request.query as any) ?? {}
    const term = (q.q as string | undefined)?.trim()
    const where: any = { activo: true }
    if (term && term.length >= 2) {
      where.OR = [
        { nombre_comercial: { contains: term, mode: 'insensitive' } },
        { principio_activo: { contains: term, mode: 'insensitive' } },
      ]
    }
    return prisma.medicamento.findMany({
      where,
      take: 30,
      orderBy: { nombre_comercial: 'asc' },
      select: {
        id: true,
        codigo_externo: true,
        nombre_comercial: true,
        principio_activo: true,
        laboratorio: true,
        presentacion: true,
        via_admin: true,
        prescripcion_requerida: true,
      },
    })
  })

  app.get('/:id', async (request, reply) => {
    request.requireAuth()
    const { id } = parseOrFail(idParamSchema, request.params)
    const m = await prisma.medicamento.findUnique({ where: { id } })
    if (!m) return notFound(reply, 'Medicamento')
    return {
      ...m,
      interacciones: m.interacciones ? JSON.parse(m.interacciones) : [],
    }
  })

  app.post('/', async (request, reply) => {
    const user = request.requirePermiso('prestacion:editar', { flexible: true })
    const data = parseOrFail(medicamentoSchema, request.body)
    const { interacciones, ...rest } = data
    const m = await prisma.medicamento.create({
      data: {
        ...rest,
        interacciones: interacciones ? JSON.stringify(interacciones) : null,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Medicamento',
      entidad_id: m.id,
      ...auditMetaFromRequest(request),
    })
    return reply.code(201).send(m)
  })

  /**
   * Chequea interacciones y alergias para un paciente vs. lista de medicamentos.
   * Retorna alertas a mostrar antes de firmar receta.
   */
  app.post('/check-alertas', async (request) => {
    request.requireAuth()
    const body = parseOrFail(
      z.object({
        paciente_id: z.string(),
        medicamento_ids: z.array(z.string()).min(1),
      }),
      request.body,
    )

    const [medicamentos, hc] = await Promise.all([
      prisma.medicamento.findMany({ where: { id: { in: body.medicamento_ids } } }),
      prisma.historiaClinica.findUnique({
        where: { paciente_id: body.paciente_id },
        include: {
          alergias: { where: { activa: true } },
          medicaciones: { where: { activa: true } },
        },
      }),
    ])

    const alertas: Array<{ tipo: string; severidad: string; mensaje: string; medicamento_id?: string }> = []

    // Chequear alergias del paciente vs principios activos de la receta
    if (hc?.alergias) {
      for (const med of medicamentos) {
        for (const alergia of hc.alergias) {
          if (med.principio_activo.toLowerCase().includes(alergia.sustancia.toLowerCase()) ||
              alergia.sustancia.toLowerCase().includes(med.principio_activo.toLowerCase())) {
            alertas.push({
              tipo: 'ALERGIA',
              severidad: alergia.severidad,
              mensaje: `Paciente con alergia a ${alergia.sustancia} (${alergia.severidad}). Reacción: ${alergia.reaccion ?? 'no registrada'}.`,
              medicamento_id: med.id,
            })
          }
        }
      }
    }

    // Chequear interacciones entre medicamentos seleccionados
    for (const med of medicamentos) {
      if (!med.interacciones) continue
      const inter = JSON.parse(med.interacciones) as Array<{ principio: string; severidad: string; descripcion?: string }>
      for (const otro of medicamentos) {
        if (otro.id === med.id) continue
        const match = inter.find((i) => i.principio.toLowerCase() === otro.principio_activo.toLowerCase())
        if (match) {
          alertas.push({
            tipo: 'INTERACCION',
            severidad: match.severidad,
            mensaje: `Interacción ${med.nombre_comercial} ↔ ${otro.nombre_comercial} (${match.severidad}). ${match.descripcion ?? ''}`,
            medicamento_id: med.id,
          })
        }
      }
    }

    // Chequear interacciones con medicación habitual del paciente
    if (hc?.medicaciones) {
      for (const med of medicamentos) {
        if (!med.interacciones) continue
        const inter = JSON.parse(med.interacciones) as Array<{ principio: string; severidad: string; descripcion?: string }>
        for (const mh of hc.medicaciones) {
          const match = inter.find((i) => mh.medicamento.toLowerCase().includes(i.principio.toLowerCase()))
          if (match) {
            alertas.push({
              tipo: 'INTERACCION_MEDICACION_HABITUAL',
              severidad: match.severidad,
              mensaje: `${med.nombre_comercial} interactúa con ${mh.medicamento} (medicación habitual del paciente). ${match.descripcion ?? ''}`,
              medicamento_id: med.id,
            })
          }
        }
      }
    }

    return { alertas, total: alertas.length }
  })
}
