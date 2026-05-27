/**
 * Generador y parser de external_reference para Mercado Pago.
 * Formato: turno_{turnoId}_{nanoid8}
 * Permite múltiples intentos de pago por turno (cada uno con su PagoMercadoPago).
 */

const NANOID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const NANOID_LENGTH = 8

function generateNanoid8(): string {
  let result = ''
  for (let i = 0; i < NANOID_LENGTH; i++) {
    const idx = Math.floor(Math.random() * NANOID_ALPHABET.length)
    result += NANOID_ALPHABET[idx]
  }
  return result
}

export function generateExternalReference(turnoId: string): string {
  return `turno_${turnoId}_${generateNanoid8()}`
}

export function parseExternalReference(externalRef: string): { turnoId: string } | null {
  if (!externalRef.startsWith('turno_')) return null
  const lastUnderscore = externalRef.lastIndexOf('_')
  if (lastUnderscore <= 'turno_'.length) return null
  const turnoId = externalRef.substring('turno_'.length, lastUnderscore)
  if (!turnoId) return null
  const suffix = externalRef.substring(lastUnderscore + 1)
  if (suffix.length !== NANOID_LENGTH) return null
  return { turnoId }
}
