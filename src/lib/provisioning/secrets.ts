import 'server-only'
import { randomBytes, createHash } from 'crypto'

const SAFE_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'  // sin 0/O/1/l

function pickFrom(buffer: Buffer, alphabet: string, length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[buffer[i % buffer.length] % alphabet.length]
  }
  return out
}

export function generatePassword(length = 24): string {
  if (length < 12) throw new Error('Password length too short')
  // Tomamos suficientes bytes para tener buena entropía
  const buf = randomBytes(length * 2)
  return pickFrom(buf, SAFE_ALPHABET, length)
}

export function generateHexKey(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export interface ClientSecrets {
  postgresPassword:  string
  redisPassword:     string
  n8nBasicAuthPass:  string
  n8nEncryptionKey:  string
  apiJwtSecret:      string
  webhookSecret:     string
  adminTempPassword: string
}

export function buildClientSecrets(): ClientSecrets {
  return {
    postgresPassword:  generatePassword(28),
    redisPassword:     generatePassword(24),
    n8nBasicAuthPass:  generatePassword(20),
    n8nEncryptionKey:  generateHexKey(32),
    apiJwtSecret:      generateHexKey(48),
    webhookSecret:     generateHexKey(24),
    adminTempPassword: generatePassword(16),
  }
}
