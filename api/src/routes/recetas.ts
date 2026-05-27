/**
 * Recetas electrónicas y órdenes médicas.
 *
 * Flow típico:
 *   1. POST /recetas  → crea en BORRADOR
 *   2. POST /recetas/:id/firmar  → calcula hash, marca FIRMADA
 *   3. POST /recetas/:id/enviar  → genera PDF, sube MinIO, dispara n8n para envío WA
 *
 * Arquitectura preparada para integrar proveedor externo (proveedor_externo + external_id).
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { dispararEventoN8n } from '../lib/n8n'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'
import { s3, BUCKET, PUBLIC_URL } from '../lib/storage'

const tipoOrden = z.enum(['RECETA', 'ORDEN_ESTUDIO', 'CERTIFICADO', 'INDICACION_MEDICA'])

const itemSchema = z.object({
  medicamento_id: z.string().nullable().optional(),
  descripcion: z.string().min(1),
  presentacion: z.string().nullable().optional(),
  cantidad: z.string().nullable().optional(),
  posologia: z.string().nullable().optional(),
  duracion: z.string().nullable().optional(),
  via: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
})

const recetaSchema = z.object({
  paciente_id: z.string(),
  profesional_id: z.string(),
  evolucion_id: z.string().nullable().optional(),
  turno_id: z.string().nullable().optional(),
  tipo: tipoOrden.optional(),
  diagnostico_cie10: z.string().nullable().optional(),
  diagnostico_texto: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1),
})

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

async function generarPdfReceta(recetaId: string): Promise<{ url: string; buffer: Buffer }> {
  const r = await prisma.receta.findUnique({
    where: { id: recetaId },
    include: {
      items: { orderBy: { orden: 'asc' } },
      paciente: true,
    },
  })
  if (!r) throw new Error('Receta no encontrada')
  const profesional = await prisma.perfilProfesional.findUnique({
    where: { id: r.profesional_id },
    include: { usuario: true, especialidad: true },
  })
  const clinica = await prisma.configuracionClinica.findUnique({ where: { id: 'singleton' } })

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const stream = new PassThrough()
  doc.pipe(stream)

  doc.fontSize(18).text(clinica?.nombre ?? 'Clínica', { align: 'left' })
  if (clinica?.razon_social) doc.fontSize(10).text(clinica.razon_social)
  doc.fontSize(10).text(`Fecha: ${r.fecha.toLocaleDateString('es-AR')}`, { align: 'right' })
  doc.moveDown()

  const titulo = r.tipo === 'RECETA' ? 'Receta médica'
    : r.tipo === 'ORDEN_ESTUDIO' ? 'Orden de estudios'
      : r.tipo === 'CERTIFICADO' ? 'Certificado médico'
        : 'Indicaciones médicas'
  doc.fontSize(15).text(titulo, { align: 'center' }).moveDown()

  doc.fontSize(11).font('Helvetica-Bold').text('Paciente:', { continued: true })
    .font('Helvetica').text(` ${r.paciente.apellido}, ${r.paciente.nombre}  ·  DNI ${r.paciente.dni}`)
  if (profesional) {
    doc.font('Helvetica-Bold').text('Profesional:', { continued: true })
      .font('Helvetica').text(` ${profesional.usuario.apellido}, ${profesional.usuario.nombre}  ·  MN ${profesional.matricula}  ·  ${profesional.especialidad.nombre}`)
  }
  if (r.diagnostico_texto || r.diagnostico_cie10) {
    doc.font('Helvetica-Bold').text('Diagnóstico:', { continued: true })
      .font('Helvetica').text(` ${r.diagnostico_texto ?? ''}${r.diagnostico_cie10 ? ` [CIE-10: ${r.diagnostico_cie10}]` : ''}`)
  }
  doc.moveDown()

  doc.fontSize(11).font('Helvetica-Bold').text('Indicación:').moveDown(0.3).font('Helvetica')
  r.items.forEach((it, idx) => {
    doc.fontSize(11).font('Helvetica-Bold').text(`${idx + 1}. ${it.descripcion}`, { continued: false })
    doc.font('Helvetica').fontSize(10)
    if (it.presentacion) doc.text(`   Presentación: ${it.presentacion}`)
    if (it.cantidad) doc.text(`   Cantidad: ${it.cantidad}`)
    if (it.posologia) doc.text(`   Posología: ${it.posologia}`)
    if (it.duracion) doc.text(`   Duración: ${it.duracion}`)
    if (it.via) doc.text(`   Vía: ${it.via}`)
    if (it.observaciones) doc.text(`   Obs: ${it.observaciones}`)
    doc.moveDown(0.5)
  })

  if (r.observaciones) {
    doc.moveDown().fontSize(11).font('Helvetica-Bold').text('Observaciones generales:')
      .font('Helvetica').fontSize(10).text(r.observaciones)
  }

  // Firma
  doc.moveDown(3).fontSize(9)
  if (r.firmada_at && profesional) {
    doc.text('_____________________________', { align: 'right' })
    doc.text(`${profesional.usuario.apellido}, ${profesional.usuario.nombre}`, { align: 'right' })
    doc.text(`MN ${profesional.matricula}`, { align: 'right' })
    doc.text(`Firmado: ${r.firmada_at.toLocaleString('es-AR')}`, { align: 'right' })
    if (r.firma_hash) doc.text(`Hash: ${r.firma_hash.slice(0, 16)}...`, { align: 'right' })
  } else {
    doc.text('[Documento sin firmar]', { align: 'right' })
  }

  doc.end()
  const buffer = await streamToBuffer(stream)
  const key = `recetas/${r.id}.pdf`
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
  }))
  return { url: `${PUBLIC_URL}/${BUCKET}/${key}`, buffer }
}

export async function recetasRoutes(app: FastifyInstance) {
  // POST /recetas — crear borrador
  app.post('/', async (request, reply) => {
    const user = request.requirePermiso('indicacion:crear')
    const data = parseOrFail(recetaSchema, request.body)

    const receta = await prisma.receta.create({
      data: {
        paciente_id: data.paciente_id,
        profesional_id: data.profesional_id,
        evolucion_id: data.evolucion_id ?? null,
        turno_id: data.turno_id ?? null,
        tipo: data.tipo ?? 'RECETA',
        diagnostico_cie10: data.diagnostico_cie10 ?? null,
        diagnostico_texto: data.diagnostico_texto ?? null,
        observaciones: data.observaciones ?? null,
        estado: 'BORRADOR',
        items: {
          create: data.items.map((it, idx) => ({
            medicamento_id: it.medicamento_id ?? null,
            descripcion: it.descripcion,
            presentacion: it.presentacion ?? null,
            cantidad: it.cantidad ?? null,
            posologia: it.posologia ?? null,
            duracion: it.duracion ?? null,
            via: it.via ?? null,
            observaciones: it.observaciones ?? null,
            orden: idx,
          })),
        },
      },
      include: { items: true },
    })

    await writeAudit({
      usuario_id: user.id,
      accion: 'CREAR',
      entidad: 'Receta',
      entidad_id: receta.id,
      contexto: { paciente_id: data.paciente_id },
      ...auditMetaFromRequest(request),
    })
    return reply.code(201).send(receta)
  })

  // POST /recetas/:id/firmar — calcula hash y marca FIRMADA
  app.post('/:id/firmar', async (request, reply) => {
    const user = request.requirePermiso('indicacion:crear')
    const { id } = parseOrFail(idParamSchema, request.params)
    const r = await prisma.receta.findUnique({
      where: { id },
      include: { items: { orderBy: { orden: 'asc' } } },
    })
    if (!r) return notFound(reply, 'Receta')
    if (r.estado !== 'BORRADOR') {
      return reply.code(400).send({ error: 'Bad request', message: `Receta en estado ${r.estado}` })
    }
    if (!user.perfil_profesional_id || user.perfil_profesional_id !== r.profesional_id) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Solo el profesional autor puede firmar' })
    }

    // Contenido firmado: estructura determinística
    const contenido = JSON.stringify({
      receta_id: r.id,
      paciente_id: r.paciente_id,
      profesional_id: r.profesional_id,
      fecha: r.fecha.toISOString(),
      diagnostico_cie10: r.diagnostico_cie10,
      diagnostico_texto: r.diagnostico_texto,
      items: r.items.map((it) => ({
        descripcion: it.descripcion,
        posologia: it.posologia,
        cantidad: it.cantidad,
        duracion: it.duracion,
        via: it.via,
      })),
    })
    const hash = crypto.createHash('sha256').update(contenido).digest('hex')

    const firmada = await prisma.receta.update({
      where: { id },
      data: { estado: 'FIRMADA', firmada_at: new Date(), firma_hash: hash },
    })

    await writeAudit({
      usuario_id: user.id,
      accion: 'FIRMAR',
      entidad: 'Receta',
      entidad_id: id,
      contexto: { paciente_id: r.paciente_id, hash: hash.slice(0, 16) },
      ...auditMetaFromRequest(request),
    })

    return firmada
  })

  // POST /recetas/:id/enviar — genera PDF, lo sube y dispara evento n8n para envío WA
  app.post('/:id/enviar', async (request, reply) => {
    const user = request.requirePermiso('indicacion:crear')
    const { id } = parseOrFail(idParamSchema, request.params)
    const body = parseOrFail(
      z.object({ canal: z.enum(['WHATSAPP', 'EMAIL']).default('WHATSAPP') }),
      request.body ?? {},
    )

    const r = await prisma.receta.findUnique({ where: { id }, include: { paciente: true } })
    if (!r) return notFound(reply, 'Receta')
    if (r.estado !== 'FIRMADA') {
      return reply.code(400).send({ error: 'Bad request', message: 'La receta debe estar FIRMADA para enviar' })
    }

    const { url } = await generarPdfReceta(id)

    const actualizada = await prisma.receta.update({
      where: { id },
      data: { estado: 'ENVIADA', enviada_at: new Date(), enviada_canal: body.canal, pdf_url: url },
    })

    // Disparar evento a n8n para que envíe por WhatsApp/email
    dispararEventoN8n('receta-enviada', {
      receta_id: id,
      paciente_id: r.paciente_id,
      paciente_telefono: r.paciente.telefono,
      paciente_email: r.paciente.email,
      pdf_url: url,
      canal: body.canal,
    }).catch(() => {})

    await writeAudit({
      usuario_id: user.id,
      accion: 'EXPORTAR',
      entidad: 'Receta',
      entidad_id: id,
      contexto: { paciente_id: r.paciente_id, canal: body.canal, pdf_url: url },
      ...auditMetaFromRequest(request),
    })

    return actualizada
  })

  // GET /recetas?paciente_id=...
  app.get('/', async (request) => {
    request.requirePermiso('indicacion:ver')
    const q = (request.query as any) ?? {}
    const where: any = {}
    if (q.paciente_id) where.paciente_id = q.paciente_id
    if (q.profesional_id) where.profesional_id = q.profesional_id
    if (q.estado) where.estado = q.estado
    return prisma.receta.findMany({
      where,
      include: { items: { orderBy: { orden: 'asc' } } },
      orderBy: { fecha: 'desc' },
      take: 100,
    })
  })

  app.get('/:id', async (request, reply) => {
    request.requirePermiso('indicacion:ver')
    const { id } = parseOrFail(idParamSchema, request.params)
    const r = await prisma.receta.findUnique({
      where: { id },
      include: {
        items: { orderBy: { orden: 'asc' } },
        paciente: { select: { id: true, nombre: true, apellido: true, dni: true, telefono: true, email: true } },
      },
    })
    if (!r) return notFound(reply, 'Receta')
    return r
  })
}
