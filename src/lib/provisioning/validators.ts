// Validaciones puras (sin acceso a Firestore) usadas tanto en frontend
// (para feedback inmediato) como en backend (como gate antes de escribir).

import type { ProductType, DeploymentMode } from '@/types/provisioning'

// Reservados que no pueden usarse como slug por razones operativas:
// chocarían con servicios compartidos de la infra o con nombres de
// contenedor especiales.
export const RESERVED_SLUGS = new Set([
  'postgres', 'redis', 'traefik', 'n8n', 'api', 'app', 'crm', 'admin',
  'proxy', 'root', 'www', 'mail', 'ftp', 'backup', 'monitoring',
  'grafana', 'prometheus', 'fluxtic', 'platform', 'console',
])

const SLUG_REGEX     = /^[a-z][a-z0-9-]{2,39}$/
const DOMAIN_REGEX   = /^(?=.{1,253}$)((?!-)[a-z0-9-]{1,63}(?<!-)\.)+[a-z]{2,}$/i
const EMAIL_REGEX    = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const PRODUCT_TYPES: ReadonlyArray<ProductType> = [
  'salud', 'beauty', 'gastro', 'personalizado',
]
const MODES: ReadonlyArray<DeploymentMode> = ['demo', 'produccion']

export interface ValidationResult {
  ok:     boolean
  reason?: string
}

export function validateSlugFormat(slug: string): ValidationResult {
  if (!slug) return { ok: false, reason: 'El slug es obligatorio' }
  if (slug.length < 3)  return { ok: false, reason: 'Mínimo 3 caracteres' }
  if (slug.length > 40) return { ok: false, reason: 'Máximo 40 caracteres' }
  if (!SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      reason: 'Sólo minúsculas, números y guiones. Debe empezar con una letra.',
    }
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, reason: 'Ese slug está reservado por la plataforma' }
  }
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { ok: false, reason: 'No puede empezar ni terminar con guion' }
  }
  if (slug.includes('--')) {
    return { ok: false, reason: 'No se permiten guiones consecutivos' }
  }
  return { ok: true }
}

export function validateDomainFormat(domain: string): ValidationResult {
  if (!domain) return { ok: false, reason: 'El dominio es obligatorio' }
  if (domain.length > 253) return { ok: false, reason: 'Dominio demasiado largo' }
  if (!DOMAIN_REGEX.test(domain)) {
    return { ok: false, reason: 'Formato de dominio inválido' }
  }
  // Defensa adicional: rechazar caracteres peligrosos para evitar inyección
  // si alguna vez llegan a un comando.
  if (/[\s;|&`$()<>"'\\]/.test(domain)) {
    return { ok: false, reason: 'Caracteres no permitidos en dominio' }
  }
  return { ok: true }
}

export function validateEmail(email: string): ValidationResult {
  if (!email) return { ok: false, reason: 'Email obligatorio' }
  if (!EMAIL_REGEX.test(email)) return { ok: false, reason: 'Email inválido' }
  return { ok: true }
}

export function validateHexColor(c: string): ValidationResult {
  if (!HEX_COLOR_REGEX.test(c)) return { ok: false, reason: 'Color hex inválido' }
  return { ok: true }
}

export function validateProductType(p: string): p is ProductType {
  return (PRODUCT_TYPES as ReadonlyArray<string>).includes(p)
}

export function validateMode(m: string): m is DeploymentMode {
  return (MODES as ReadonlyArray<string>).includes(m)
}

// Sanitiza un slug ya validado para componer paths. Devuelve el slug
// tal cual si pasó el regex; lanza si no.
export function safeSlug(slug: string): string {
  const result = validateSlugFormat(slug)
  if (!result.ok) throw new Error(`Slug inválido: ${result.reason}`)
  return slug
}

export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // quita tildes
    .replace(/[^a-z0-9\s-]/g, '')      // sólo alfanum/espacio/guion
    .trim()
    .replace(/\s+/g, '-')              // espacios -> guion
    .replace(/-+/g, '-')               // colapsa
    .replace(/^-|-$/g, '')             // recorta extremos
    .slice(0, 40)
}
