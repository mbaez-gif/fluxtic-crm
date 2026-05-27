/**
 * Generación de PDF (recibos y recetas).
 * Sube el archivo a MinIO y devuelve URL presignada para descarga.
 *
 * Adaptado del módulo PDF de Delfina Paz al dominio clínico.
 */
import type { FastifyInstance } from 'fastify'
import PDFDocument from 'pdfkit'
import { PassThrough } from 'stream'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '../lib/prisma'
import { s3, BUCKET, PUBLIC_URL } from '../lib/storage'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { idParamSchema, parseOrFail, notFound } from '../lib/zod-helpers'

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

async function uploadPdf(key: string, buffer: Buffer): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
  }))
  return `${PUBLIC_URL}/${BUCKET}/${key}`
}

export async function pdfRoutes(app: FastifyInstance) {
  // POST /pdf/comprobante/:id  → genera recibo PDF a partir de un Comprobante
  app.post('/comprobante/:id', async (request, reply) => {
    const user = request.requirePermiso('comprobante:ver')
    const { id } = parseOrFail(idParamSchema, request.params)
    const comp = await prisma.comprobante.findUnique({
      where: { id },
      include: {
        paciente: true,
        items: true,
        pagos: true,
      },
    })
    if (!comp) return notFound(reply, 'Comprobante')

    const clinica = await prisma.configuracionClinica.findUnique({ where: { id: 'singleton' } })

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const out = new PassThrough()
    doc.pipe(out)

    // Header
    doc.fontSize(18).text(clinica?.nombre ?? 'Clínica', { align: 'left' })
    if (clinica?.razon_social) doc.fontSize(10).text(clinica.razon_social)
    if (clinica?.cuit) doc.fontSize(10).text(`CUIT: ${clinica.cuit}`)
    doc.moveDown()

    doc.fontSize(14).text(`${comp.tipo} ${comp.numero ?? `Nº ${comp.id.slice(-8).toUpperCase()}`}`, { align: 'right' })
    doc.fontSize(10).text(`Fecha: ${comp.fecha.toLocaleDateString('es-AR')}`, { align: 'right' })
    doc.moveDown()

    // Paciente
    doc.fontSize(12).text('Paciente:', { continued: true }).font('Helvetica-Bold').text(` ${comp.paciente.apellido}, ${comp.paciente.nombre}`)
    doc.font('Helvetica').text(`DNI: ${comp.paciente.dni}`)
    doc.moveDown()

    // Items
    doc.fontSize(11).font('Helvetica-Bold').text('Detalle')
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.font('Helvetica').fontSize(10)
    comp.items.forEach((it) => {
      const subtotal = Number(it.subtotal).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
      doc.text(`${it.cantidad}x  ${it.descripcion}`, { continued: true })
        .text(subtotal, { align: 'right' })
    })
    doc.moveDown()
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.font('Helvetica-Bold').fontSize(12)
    doc.text(`Subtotal: ${Number(comp.subtotal).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`, { align: 'right' })
    if (Number(comp.descuento) > 0) {
      doc.text(`Descuento: -${Number(comp.descuento).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`, { align: 'right' })
    }
    doc.text(`Total: ${Number(comp.total).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`, { align: 'right' })
    doc.text(`Pagado: ${Number(comp.total_pagado).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`, { align: 'right' })
    doc.text(`Saldo: ${Number(comp.saldo).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}`, { align: 'right' })

    doc.moveDown(2).fontSize(9).font('Helvetica').text(`Estado: ${comp.estado}`, { align: 'center' })

    doc.end()
    const buffer = await streamToBuffer(out)
    const key = `comprobantes/${comp.id}.pdf`
    const url = await uploadPdf(key, buffer)

    await writeAudit({
      usuario_id: user.id,
      accion: 'EXPORTAR',
      entidad: 'Comprobante',
      entidad_id: comp.id,
      contexto: { paciente_id: comp.paciente_id, formato: 'pdf' },
      ...auditMetaFromRequest(request),
    })

    return { url, key, generado_at: new Date() }
  })

  // GET /pdf/comprobante/:id/download  → URL presignada de descarga
  app.get('/comprobante/:id/download', async (request, reply) => {
    request.requirePermiso('comprobante:ver')
    const { id } = parseOrFail(idParamSchema, request.params)
    const key = `comprobantes/${id}.pdf`
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 300 })
    return { url, expires_in: 300 }
  })

  // POST /pdf/receta/:evolucion_id  → genera receta PDF a partir de las Indicaciones de una evolución
  app.post('/receta/:id', async (request, reply) => {
    const user = request.requirePermiso('indicacion:ver')
    const { id } = parseOrFail(idParamSchema, request.params)
    const evol = await prisma.evolucionClinica.findUnique({
      where: { id },
      include: {
        historia: { include: { paciente: true } },
        profesional: { include: { usuario: true, especialidad: true } },
        indicaciones: true,
      },
    })
    if (!evol) return notFound(reply, 'Evolucion')
    const paciente = evol.historia.paciente
    const clinica = await prisma.configuracionClinica.findUnique({ where: { id: 'singleton' } })

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const out = new PassThrough()
    doc.pipe(out)

    doc.fontSize(18).text(clinica?.nombre ?? 'Clínica', { align: 'left' })
    doc.fontSize(10).text(`Fecha: ${evol.fecha.toLocaleDateString('es-AR')}`, { align: 'right' })
    doc.moveDown()

    doc.fontSize(14).text('Indicaciones médicas', { align: 'center' })
    doc.moveDown()

    doc.fontSize(11).font('Helvetica-Bold').text('Paciente:', { continued: true })
      .font('Helvetica').text(` ${paciente.apellido}, ${paciente.nombre}  ·  DNI ${paciente.dni}`)
    doc.font('Helvetica-Bold').text('Profesional:', { continued: true })
      .font('Helvetica').text(` ${evol.profesional.usuario.apellido}, ${evol.profesional.usuario.nombre}  ·  MN ${evol.profesional.matricula}  ·  ${evol.profesional.especialidad.nombre}`)
    doc.moveDown()

    if (evol.indicaciones.length === 0) {
      doc.fontSize(11).text('Sin indicaciones registradas.', { align: 'center' })
    } else {
      doc.fontSize(11).font('Helvetica-Bold').text('Indicaciones:')
      doc.moveDown(0.5).font('Helvetica')
      evol.indicaciones.forEach((i, idx) => {
        doc.text(`${idx + 1}. ${i.texto}`)
        doc.moveDown(0.3)
      })
    }

    doc.moveDown(3)
    doc.fontSize(9).text('_____________________________', { align: 'right' })
    doc.text(`${evol.profesional.usuario.apellido}, ${evol.profesional.usuario.nombre}`, { align: 'right' })
    doc.text(`MN ${evol.profesional.matricula}`, { align: 'right' })

    doc.end()
    const buffer = await streamToBuffer(out)
    const key = `recetas/${evol.id}.pdf`
    const url = await uploadPdf(key, buffer)

    await writeAudit({
      usuario_id: user.id,
      accion: 'EXPORTAR',
      entidad: 'EvolucionClinica',
      entidad_id: evol.id,
      contexto: { paciente_id: paciente.id, formato: 'receta_pdf' },
      ...auditMetaFromRequest(request),
    })

    return { url, key, generado_at: new Date() }
  })
}
