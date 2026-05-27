/**
 * Configuracion de la clinica (3 singletons):
 *  - GET/PATCH /configuracion/clinica       — datos de la organizacion
 *  - GET/PATCH /configuracion/agenda        — reglas de slot, sobreturnos, recordatorios
 *  - GET/PATCH /configuracion/facturacion   — sena, medios de pago, numerador
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { parseOrFail } from '../lib/zod-helpers'

const clinicaSchema = z.object({
  nombre: z.string().min(1).optional(),
  razon_social: z.string().nullable().optional(),
  cuit: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  sitio_web: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  color_principal: z.string().optional(),
  color_acento: z.string().optional(),
  zona_horaria: z.string().optional(),
  moneda: z.string().optional(),
})

const agendaSchema = z.object({
  duracion_slot_min: z.number().int().positive().optional(),
  permite_sobreturnos: z.boolean().optional(),
  permite_lista_espera: z.boolean().optional(),
  anticipacion_min_horas: z.number().int().nonnegative().optional(),
  cancelacion_min_horas: z.number().int().nonnegative().optional(),
  recordatorio_48h: z.boolean().optional(),
  recordatorio_24h: z.boolean().optional(),
  recordatorio_2h: z.boolean().optional(),
  marcar_no_show_min_minutos: z.number().int().nonnegative().optional(),
})

const facturacionSchema = z.object({
  requiere_sena: z.boolean().optional(),
  monto_sena_default: z.number().nonnegative().nullable().optional(),
  porcentaje_sena: z.number().min(0).max(100).nullable().optional(),
  acepta_mercadopago: z.boolean().optional(),
  acepta_transferencia: z.boolean().optional(),
  numerador_recibo: z.number().int().nonnegative().optional(),
  prefijo_recibo: z.string().nullable().optional(),
})

export async function configuracionRoutes(app: FastifyInstance) {
  // ── Clinica ─────────────────────────────────────────────────
  app.get('/clinica', async (request) => {
    request.requireAuth()
    return await prisma.configuracionClinica.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    })
  })

  app.patch('/clinica', async (request, reply) => {
    const user = request.requirePermiso('*' as any, { flexible: true })
    const data = parseOrFail(clinicaSchema, request.body)
    const c = await prisma.configuracionClinica.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'ConfiguracionClinica',
      entidad_id: 'singleton',
      diff: data,
      ...auditMetaFromRequest(request),
    })
    return c
  })

  // ── Agenda ──────────────────────────────────────────────────
  app.get('/agenda', async (request) => {
    request.requireAuth()
    return await prisma.configuracionAgenda.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    })
  })

  app.patch('/agenda', async (request, reply) => {
    const user = request.requirePermiso('agenda:editar', { flexible: true })
    const data = parseOrFail(agendaSchema, request.body)
    const c = await prisma.configuracionAgenda.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data },
      update: data,
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'ConfiguracionAgenda',
      entidad_id: 'singleton',
      diff: data,
      ...auditMetaFromRequest(request),
    })
    return c
  })

  // ── Facturacion ─────────────────────────────────────────────
  app.get('/facturacion', async (request) => {
    request.requirePermiso('comprobante:ver')
    return await prisma.configuracionFacturacion.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
    })
  })

  app.patch('/facturacion', async (request, reply) => {
    const user = request.requirePermiso('comprobante:editar', { flexible: true })
    const data = parseOrFail(facturacionSchema, request.body)
    const c = await prisma.configuracionFacturacion.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...data, monto_sena_default: data.monto_sena_default as any, porcentaje_sena: data.porcentaje_sena as any },
      update: { ...data, monto_sena_default: data.monto_sena_default as any, porcentaje_sena: data.porcentaje_sena as any },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'MODIFICAR',
      entidad: 'ConfiguracionFacturacion',
      entidad_id: 'singleton',
      diff: data,
      ...auditMetaFromRequest(request),
    })
    return c
  })
}
