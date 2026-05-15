import type { FastifyInstance } from 'fastify'
import PDFDocument from 'pdfkit'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import type { PrismaClient } from '@prisma/client'

const s3 = new S3Client({
  endpoint:         process.env.MINIO_ENDPOINT ?? 'http://minio-salud:9000',
  region:           'us-east-1',
  credentials: {
    accessKeyId:     process.env.MINIO_ACCESS_KEY  ?? 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY  ?? 'minioadmin',
  },
  forcePathStyle: true,
})

const BUCKET = process.env.MINIO_BUCKET ?? 'delfina'

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n)
}

// ── Genera el buffer PDF de una venta ───────────────────────────────────────
export async function generarPdfVenta(prisma: PrismaClient, id: string): Promise<{ buffer: Buffer; filename: string } | null> {
  const [venta, plantilla] = await Promise.all([
    prisma.venta.findUnique({
      where: { id },
      include: {
        cliente:     { select: { nombre: true, apellido: true, telefono: true, email: true } },
        profesional: { select: { nombre: true, apellido: true } },
        items:       true,
      },
    }),
    prisma.plantillaComprobante.findFirst(),
  ])

  if (!venta) return null

  const cfg = plantilla ?? {
    nombre_comercial: 'Delfina Paz Beauty',
    cuit: null, direccion: null, telefono: null, instagram: null,
    logo_url: null, color_principal: '#A68660', texto_footer: null,
    mostrar_logo: true, mostrar_cuit: false, mostrar_direccion: true,
    mostrar_telefono: true, mostrar_instagram: true, mostrar_qr: false,
    tipo_documento: 'COMPROBANTE',
  }

  const colorHex = (cfg.color_principal ?? '#A68660').replace('#', '')
  const colorRgb = {
    r: parseInt(colorHex.slice(0, 2), 16),
    g: parseInt(colorHex.slice(2, 4), 16),
    b: parseInt(colorHex.slice(4, 6), 16),
  }

  const doc    = new PDFDocument({ size: 'A4', margin: 50 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))

  // ── Header ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 90).fill([colorRgb.r, colorRgb.g, colorRgb.b])
  doc.fillColor('white').font('Helvetica-Bold').fontSize(22).text(cfg.nombre_comercial, 50, 28)

  const tipoDoc = (cfg as any).tipo_documento ?? 'COMPROBANTE'
  doc.font('Helvetica').fontSize(10).text(`${tipoDoc} INTERNO`, 50, 54)
  if ((cfg as any).mostrar_cuit && (cfg as any).cuit) {
    doc.text(`CUIT: ${(cfg as any).cuit}`, 50, 68)
  }

  const numComp = venta.numero_comprobante
    ? String(venta.numero_comprobante).padStart(8, '0')
    : venta.id.slice(-8).toUpperCase()
  doc.font('Helvetica-Bold').fontSize(12)
     .text(`N° ${numComp}`, 0, 28, { align: 'right', width: doc.page.width - 50 })
  doc.font('Helvetica').fontSize(10)
     .text(new Date(venta.createdAt).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' }), 0, 46, { align: 'right', width: doc.page.width - 50 })

  doc.fillColor('#1C1814').moveDown(4)

  // ── Info negocio + cliente ───────────────────────────────────────────────
  const col1X = 50, col2X = 320, rowY = 105

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#8C847A').text('DATOS DEL NEGOCIO', col1X, rowY)
  doc.font('Helvetica').fontSize(10).fillColor('#1C1814')
  let y = rowY + 14
  if ((cfg as any).mostrar_direccion && (cfg as any).direccion) { doc.text((cfg as any).direccion, col1X, y); y += 14 }
  if ((cfg as any).mostrar_telefono  && (cfg as any).telefono)  { doc.text((cfg as any).telefono,  col1X, y); y += 14 }
  if ((cfg as any).mostrar_instagram && (cfg as any).instagram) { doc.text(`@${(cfg as any).instagram}`, col1X, y); y += 14 }

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#8C847A').text('CLIENTE', col2X, rowY)
  doc.font('Helvetica').fontSize(10).fillColor('#1C1814')
  y = rowY + 14
  if (venta.cliente) {
    doc.text(`${venta.cliente.nombre} ${venta.cliente.apellido ?? ''}`.trim(), col2X, y); y += 14
    if (venta.cliente.telefono) { doc.text(venta.cliente.telefono, col2X, y); y += 14 }
    if (venta.cliente.email)    { doc.text(venta.cliente.email,    col2X, y); y += 14 }
  } else {
    doc.text('Consumidor final', col2X, y); y += 14
  }

  if (venta.profesional) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#8C847A').text('VENDEDOR/A', col2X, y)
    doc.font('Helvetica').fontSize(10).fillColor('#1C1814')
       .text(`${venta.profesional.nombre} ${venta.profesional.apellido ?? ''}`.trim(), col2X, y + 13)
  }

  // ── Separador ────────────────────────────────────────────────────────────
  const lineY = 210
  doc.moveTo(50, lineY).lineTo(doc.page.width - 50, lineY)
     .lineWidth(0.5).strokeColor([colorRgb.r, colorRgb.g, colorRgb.b]).stroke()

  // ── Tabla de items ───────────────────────────────────────────────────────
  const tableY = lineY + 12
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#8C847A')
     .text('DESCRIPCIÓN',   50,  tableY)
     .text('CANT',          350, tableY, { width: 40,  align: 'right' })
     .text('PRECIO UNIT.',  395, tableY, { width: 80,  align: 'right' })
     .text('SUBTOTAL',      480, tableY, { width: 65,  align: 'right' })

  doc.moveTo(50, tableY + 12).lineTo(doc.page.width - 50, tableY + 12)
     .lineWidth(0.3).strokeColor('#E4DDD6').stroke()

  let itemY = tableY + 20
  doc.font('Helvetica').fontSize(10).fillColor('#1C1814')
  for (const item of venta.items) {
    doc.text(item.nombre,                              50,  itemY, { width: 290 })
       .text(String(item.cantidad),                    350, itemY, { width: 40,  align: 'right' })
       .text(formatMoney(Number(item.precio_unitario)),395, itemY, { width: 80,  align: 'right' })
       .text(formatMoney(Number(item.subtotal)),       480, itemY, { width: 65,  align: 'right' })
    itemY += 18
    if (Number(item.descuento) > 0) {
      doc.fillColor('#8C847A').fontSize(9)
         .text(`  Descuento: -${formatMoney(Number(item.descuento))}`, 50, itemY)
      doc.fillColor('#1C1814').fontSize(10)
      itemY += 14
    }
  }

  // ── Totales ───────────────────────────────────────────────────────────────
  doc.moveTo(50, itemY + 4).lineTo(doc.page.width - 50, itemY + 4)
     .lineWidth(0.3).strokeColor('#E4DDD6').stroke()
  itemY += 16

  const totalsX = 350
  doc.font('Helvetica').fontSize(10).fillColor('#1C1814')
     .text('Subtotal:', totalsX, itemY, { width: 130, align: 'right' })
     .text(formatMoney(Number(venta.subtotal)), 480, itemY, { width: 65, align: 'right' })
  itemY += 16

  if (Number(venta.descuento) > 0) {
    doc.text('Descuento:', totalsX, itemY, { width: 130, align: 'right' })
       .fillColor('#8C847A')
       .text(`-${formatMoney(Number(venta.descuento))}`, 480, itemY, { width: 65, align: 'right' })
    doc.fillColor('#1C1814')
    itemY += 16
  }

  if (venta.sena_aplicada && Number(venta.sena_aplicada) > 0) {
    doc.text('Seña aplicada:', totalsX, itemY, { width: 130, align: 'right' })
       .fillColor('#8C847A')
       .text(`-${formatMoney(Number(venta.sena_aplicada))}`, 480, itemY, { width: 65, align: 'right' })
    doc.fillColor('#1C1814')
    itemY += 16
  }

  doc.rect(totalsX - 10, itemY, 210, 28).fill([colorRgb.r, colorRgb.g, colorRgb.b])
  doc.fillColor('white').font('Helvetica-Bold').fontSize(13)
     .text('TOTAL:', totalsX, itemY + 7, { width: 130, align: 'right' })
     .text(formatMoney(Number(venta.total)), 480, itemY + 7, { width: 65, align: 'right' })
  itemY += 40

  const medioLabels: Record<string, string> = {
    EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
    DEBITO: 'Tarjeta Débito', CREDITO: 'Tarjeta Crédito', MERCADOPAGO: 'Mercado Pago',
  }
  doc.fillColor('#1C1814').font('Helvetica').fontSize(10)
     .text(`Medio de pago: ${medioLabels[venta.medio_pago] ?? venta.medio_pago}`, 50, itemY)

  if (venta.notas) {
    itemY += 20
    doc.font('Helvetica').fontSize(9).fillColor('#8C847A').text(`Notas: ${venta.notas}`, 50, itemY)
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 60
  doc.moveTo(50, footerY).lineTo(doc.page.width - 50, footerY)
     .lineWidth(0.3).strokeColor('#E4DDD6').stroke()
  doc.font('Helvetica').fontSize(8).fillColor('#8C847A')
     .text(
       (cfg as any).texto_footer ?? `${cfg.nombre_comercial} · Comprobante interno · No válido como factura`,
       50, footerY + 8, { align: 'center', width: doc.page.width - 100 },
     )

  doc.end()
  await new Promise<void>(resolve => doc.on('end', resolve))

  const buffer = Buffer.concat(chunks)
  return { buffer, filename: `comprobante-${numComp}.pdf` }
}

// ── Sube a MinIO en background (no bloquea) ──────────────────────────────────
export function subirPdfBackground(prisma: PrismaClient, id: string, buffer: Buffer, filename: string) {
  const key = `comprobantes/${filename}`
  s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: 'application/pdf' }))
    .then(() => {
      const base = process.env.MINIO_PUBLIC_URL ?? 'https://storage-salud.fluxtic.com'
      const url  = `${base}/${BUCKET}/${key}`
      return prisma.venta.update({ where: { id }, data: { pdf_url: url } })
    })
    .catch(() => { /* falla silenciosamente — MinIO puede no estar listo */ })
}

export async function pdfRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  // POST /pdf/venta/:id — genera y devuelve el PDF como descarga directa
  app.post('/venta/:id', async (request, reply) => {
    const { id } = request.params as any

    const result = await generarPdfVenta(prisma, id)
    if (!result) return reply.notFound('Venta no encontrada')

    const { buffer, filename } = result

    // Subir a MinIO en background (no bloquea la respuesta)
    subirPdfBackground(prisma, id, buffer, filename)

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Length', String(buffer.length))
      .send(buffer)
  })

  // GET /pdf/venta/:id — también disponible como GET para links directos
  app.get('/venta/:id', async (request, reply) => {
    const { id } = request.params as any

    const result = await generarPdfVenta(prisma, id)
    if (!result) return reply.notFound('Venta no encontrada')

    const { buffer, filename } = result
    subirPdfBackground(prisma, id, buffer, filename)

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Content-Length', String(buffer.length))
      .send(buffer)
  })
}
