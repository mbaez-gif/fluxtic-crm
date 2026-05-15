import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3, BUCKET, PUBLIC_URL } from '../lib/storage'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

const tipoDoc = z.enum([
  'EVOLUCION',
  'ESTUDIO',
  'INFORME',
  'IMAGEN',
  'RECETA',
  'CONSENTIMIENTO',
  'INDICACION',
  'OTRO',
])

const presignSchema = z.object({
  paciente_id: z.string(),
  tipo: tipoDoc,
  nombre: z.string().min(1),
  mime_type: z.string().min(1),
  tamano_bytes: z.number().int().positive().optional(),
  visible_paciente: z.boolean().optional(),
})

const consentimientoSchema = z.object({
  paciente_id: z.string(),
  tipo: z.string().min(1),
  texto: z.string().min(1),
})

const estudioSchema = z.object({
  paciente_id: z.string(),
  tipo: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  fecha_solicitud: z.string().datetime().nullable().optional(),
  documento_id: z.string().nullable().optional(),
})

export async function documentosRoutes(app: FastifyInstance) {
  // Solicitar URL presignada para subir
  app.post('/presign-upload', async (req, reply) => {
    const user = req.requirePermiso('documento:crear')
    const data = parseOrFail(presignSchema, req.body)
    const key = `pacientes/${data.paciente_id}/${randomUUID()}-${data.nombre}`

    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: data.mime_type,
      }),
      { expiresIn: 600 },
    )

    // Pre-creamos el registro en estado "subiendo". Si el upload falla, el row queda huerfano (cleanup periodico podria limpiarlo).
    const doc = await prisma.documentoClinico.create({
      data: {
        paciente_id: data.paciente_id,
        tipo: data.tipo,
        nombre: data.nombre,
        storage_key: key,
        url_publica: `${PUBLIC_URL}/${BUCKET}/${key}`,
        mime_type: data.mime_type,
        tamano_bytes: data.tamano_bytes ?? null,
        subido_por_id: user.id,
        visible_paciente: data.visible_paciente ?? false,
      },
    })

    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'DocumentoClinico',
      entidad_id: doc.id,
      contexto: { paciente_id: data.paciente_id, mime_type: data.mime_type, tipo: data.tipo },
      ...auditMetaFromRequest(req),
    })

    return { documento: doc, upload_url: url, expires_in: 600 }
  })

  // Descargar (URL presignada de download)
  app.get('/:id/download', async (req, reply) => {
    const user = req.requirePermiso('documento:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    const doc = await prisma.documentoClinico.findUnique({ where: { id } })
    if (!doc) return notFound(reply, 'Documento')
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: doc.storage_key }),
      { expiresIn: 300 },
    )
    await writeAudit({
      usuario_id: user.id,
      accion: 'DESCARGAR',
      entidad: 'DocumentoClinico',
      entidad_id: id,
      contexto: { paciente_id: doc.paciente_id, tipo: doc.tipo },
      ...auditMetaFromRequest(req),
    })
    return { url, expires_in: 300 }
  })

  app.get('/paciente/:id', async (req) => {
    req.requirePermiso('documento:ver')
    const { id } = parseOrFail(idParamSchema, req.params)
    return prisma.documentoClinico.findMany({
      where: { paciente_id: id },
      orderBy: { created_at: 'desc' },
    })
  })

  // ── Consentimientos ──────────────────────────────────────────
  app.post('/consentimientos', async (req, reply) => {
    const user = req.requirePermiso('consentimiento:crear')
    const data = parseOrFail(consentimientoSchema, req.body)
    const c = await prisma.consentimiento.create({
      data: {
        paciente_id: data.paciente_id,
        tipo: data.tipo,
        texto: data.texto,
        creado_por_id: user.id,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Consentimiento',
      entidad_id: c.id,
      contexto: { paciente_id: data.paciente_id },
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(c)
  })

  app.post('/consentimientos/:id/firmar', async (req, reply) => {
    const user = req.requirePermiso('consentimiento:crear')
    const { id } = parseOrFail(idParamSchema, req.params)
    const c = await prisma.consentimiento.update({
      where: { id },
      data: { firmado: true, firmado_at: new Date() },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'FIRMAR',
      entidad: 'Consentimiento',
      entidad_id: id,
      contexto: { paciente_id: c.paciente_id },
      ...auditMetaFromRequest(req),
    })
    return c
  })

  // ── Estudios ─────────────────────────────────────────────────
  app.post('/estudios', async (req, reply) => {
    const user = req.requirePermiso('estudio:crear')
    const data = parseOrFail(estudioSchema, req.body)
    const e = await prisma.estudio.create({
      data: {
        paciente_id: data.paciente_id,
        tipo: data.tipo,
        descripcion: data.descripcion ?? null,
        fecha_solicitud: data.fecha_solicitud ? new Date(data.fecha_solicitud) : null,
        documento_id: data.documento_id ?? null,
        solicitado_por_id: user.id,
      },
    })
    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Estudio',
      entidad_id: e.id,
      contexto: { paciente_id: data.paciente_id },
      ...auditMetaFromRequest(req),
    })
    return reply.code(201).send(e)
  })
}
