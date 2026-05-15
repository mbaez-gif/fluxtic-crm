/**
 * Cliente compartido de S3/MinIO para subida de archivos.
 *
 * Usado por:
 *  - admin: POST /configuracion/comprobantes
 *  - link publico: POST /reservas-publicas/:turno_id/comprobante
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const s3 = new S3Client({
  endpoint:  process.env.MINIO_ENDPOINT ?? 'http://minio-delfina:9000',
  region:    'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId:     process.env.MINIO_ACCESS_KEY  ?? 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY  ?? 'minioadmin',
  },
})

export const BUCKET     = process.env.MINIO_BUCKET     ?? 'delfina'
export const PUBLIC_URL = process.env.MINIO_PUBLIC_URL ?? 'https://storage-delfina.fluxtic.com'

const CONTENT_TYPES: Record<string, string> = {
  pdf:  'application/pdf',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

/**
 * Sube un archivo dado en base64 a la carpeta indicada y devuelve la URL publica.
 * Si el upload falla (MinIO caido, etc.), devuelve string vacio para no romper
 * el flujo aguas arriba — el caller decide que hacer.
 */
export async function subirArchivoBase64(opts: {
  base64: string
  nombre: string
  carpeta: string
}): Promise<string> {
  try {
    const base64Data = opts.base64.replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const ext = (opts.nombre.split('.').pop() ?? 'jpg').toLowerCase()
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'
    const key = `${opts.carpeta.replace(/^\/+|\/+$/g, '')}/${Date.now()}.${ext}`
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }))
    return `${PUBLIC_URL}/${BUCKET}/${key}`
  } catch {
    return ''
  }
}
