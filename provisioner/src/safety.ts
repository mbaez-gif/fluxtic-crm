import * as path from 'node:path'
import { config } from './config.js'

const SLUG_REGEX = /^[a-z][a-z0-9-]{2,39}$/

// Reservados igual que en el frontend; defensa en profundidad: aunque
// el CRM nunca los acepte, el worker rechaza igual antes de tocar disco.
const RESERVED = new Set([
  'postgres', 'redis', 'traefik', 'n8n', 'api', 'app', 'crm', 'admin',
  'proxy', 'root', 'www', 'mail', 'ftp', 'backup', 'monitoring',
  'grafana', 'prometheus', 'fluxtic', 'platform', 'console',
])

export function assertSafeSlug(slug: string): void {
  if (!SLUG_REGEX.test(slug))
    throw new Error(`Slug inválido (regex): ${JSON.stringify(slug)}`)
  if (RESERVED.has(slug))
    throw new Error(`Slug reservado: ${slug}`)
  if (slug.includes('..') || slug.includes('/') || slug.includes('\\'))
    throw new Error(`Slug con caracteres prohibidos: ${slug}`)
}

// Verifica que un path destino caiga dentro del root permitido.
// Defensa contra path traversal incluso si Firestore se viera
// comprometido y devolviera un folderPath manipulado.
export function assertWithinRoot(target: string): void {
  const resolvedTarget = path.resolve(target)
  const resolvedRoot   = path.resolve(config.fluxticRoot)
  if (!resolvedTarget.startsWith(resolvedRoot + path.sep) && resolvedTarget !== resolvedRoot) {
    throw new Error(
      `Path fuera de FLUXTIC_ROOT (${config.fluxticRoot}): ${target}`
    )
  }
}

// Verifica que un container/proyecto siga el formato esperado.
const CONTAINER_NAME_RE = /^[a-z0-9][a-z0-9_.-]{1,62}$/
export function assertSafeContainerName(name: string): void {
  if (!CONTAINER_NAME_RE.test(name))
    throw new Error(`Container name inválido: ${JSON.stringify(name)}`)
}
