/**
 * Servicio de generación de enlaces de videoconsulta.
 *
 * Proveedor por defecto: Jitsi (público, sin auth, gratis).
 * Configurable a Google Meet / Whereby / Zoom vía env vars.
 *
 * El link se genera al confirmar el turno con modalidad VIRTUAL.
 */

import type { ProveedorVideoconsulta } from '@prisma/client'

export interface LinkVideoconsulta {
  proveedor: ProveedorVideoconsulta
  url: string
  room: string
}

function randomRoom(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
}

export function generarLinkVideoconsulta(turnoId: string): LinkVideoconsulta {
  const proveedor = (process.env.VIDEOCONSULTA_PROVEEDOR as ProveedorVideoconsulta) || 'JITSI'

  if (proveedor === 'JITSI') {
    const dominio = process.env.JITSI_DOMAIN || 'https://meet.jit.si'
    const room = randomRoom(`fluxtic-salud-${turnoId.slice(-8)}`)
    return { proveedor: 'JITSI', url: `${dominio}/${room}`, room }
  }
  if (proveedor === 'WHEREBY') {
    // Whereby requiere API call para crear room — placeholder
    const room = randomRoom('fs')
    const subdomain = process.env.WHEREBY_SUBDOMAIN || 'fluxtic'
    return { proveedor: 'WHEREBY', url: `https://${subdomain}.whereby.com/${room}`, room }
  }
  if (proveedor === 'GOOGLE_MEET') {
    // Google Meet requiere Calendar API — placeholder
    const room = randomRoom('gmeet')
    return { proveedor: 'GOOGLE_MEET', url: `https://meet.google.com/${room}`, room }
  }

  const room = randomRoom('custom')
  const baseUrl = process.env.VIDEOCONSULTA_BASE_URL || 'https://meet.jit.si'
  return { proveedor: 'CUSTOM', url: `${baseUrl}/${room}`, room }
}
