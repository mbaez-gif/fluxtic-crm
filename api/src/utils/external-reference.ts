/**
 * Generador y parser de external_reference para Mercado Pago.
 *
 * Formato: turno_{turnoId}_{nanoid8}
 *
 * Ejemplos:
 *   turno_clxyz123abc_a1b2c3d4
 *   turno_cmosqrryy000013sr7lx17vau_X9k2pQ7m
 *
 * - turnoId: cuid() de Prisma (longitud variable, ~25 chars)
 * - nanoid8: random de 8 chars URL-safe (evita colisiones si se regenera link)
 *
 * Esto permite:
 * - Múltiples intentos de pago para el mismo turno (cada uno con su PagoSena)
 * - Resolver rápido el turno desde el webhook MP sin queries extra
 * - Idempotencia por `external_reference` único en PagoSena
 */

const NANOID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const NANOID_LENGTH = 8

/**
 * Genera un nanoid de 8 caracteres URL-safe.
 * Lo hacemos manual para no depender de la lib `nanoid` (mantener deps mínimas).
 */
function generateNanoid8(): string {
  let result = ''
  for (let i = 0; i < NANOID_LENGTH; i++) {
    const idx = Math.floor(Math.random() * NANOID_ALPHABET.length)
    result += NANOID_ALPHABET[idx]
  }
  return result
}

/**
 * Genera un external_reference para un turno.
 */
export function generateExternalReference(turnoId: string): string {
  return `turno_${turnoId}_${generateNanoid8()}`
}

/**
 * Extrae el turnoId del external_reference.
 * Retorna null si el formato no es válido.
 *
 * Importante: el turnoId puede contener guiones bajos (cuid no, pero por las dudas).
 * Por eso parseamos quitando solo el prefijo y el sufijo conocidos.
 */
export function parseExternalReference(externalRef: string): { turnoId: string } | null {
  if (!externalRef.startsWith('turno_')) return null

  // Formato: turno_{turnoId}_{nanoid8}
  // El nanoid8 son los últimos 8 chars después del último guion bajo
  const lastUnderscore = externalRef.lastIndexOf('_')
  if (lastUnderscore <= 'turno_'.length) return null

  const turnoId = externalRef.substring('turno_'.length, lastUnderscore)
  if (!turnoId) return null

  // Validación básica del nanoid
  const suffix = externalRef.substring(lastUnderscore + 1)
  if (suffix.length !== NANOID_LENGTH) return null

  return { turnoId }
}
