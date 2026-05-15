// Comandos de migración / seed por producto, ejecutados después de que
// el stack esté `healthy`. Si el producto no tiene migraciones (todavía),
// el step se salta.
//
// Estos comandos asumen que la imagen de la API expone los binarios
// `prisma` y el script `seed`. Si tu imagen difiere, ajustá acá.

import type { ProductType } from './types.js'

export interface MigrationPlan {
  // Nombre del servicio en el compose (sin el slug). Lo usa `docker compose exec`.
  service: 'api'
  // Comandos a ejecutar en orden. Cada uno arranca un proceso nuevo.
  commands: string[][]
  // Si fail-fast: el primer comando que falla detiene la cadena.
  failFast: boolean
}

const SALUD: MigrationPlan = {
  service: 'api',
  commands: [
    ['npx', 'prisma', 'migrate', 'deploy'],
    // El seed se corre solo en modo demo o cuando explícitamente
    // se pide. Por ahora lo desactivamos por defecto en producción.
    // Lo dejamos comentado como referencia:
    // ['node', 'dist/seed.js'],
  ],
  failFast: true,
}

const PLANS: Record<ProductType, MigrationPlan | null> = {
  salud:         SALUD,
  beauty:        null,   // pendiente: definir cuando la imagen esté lista
  gastro:        null,
  personalizado: null,
}

export function migrationPlanFor(product: ProductType): MigrationPlan | null {
  return PLANS[product]
}
