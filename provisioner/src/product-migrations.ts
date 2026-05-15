// Comandos de migración, generación de cliente Prisma y seed por
// producto, ejecutados después de que el stack esté `healthy`.
//
// Estos comandos asumen que la imagen de la API expone los binarios
// `prisma` y el script `seed`. Si tu imagen difiere, ajustá acá.

import type { DeploymentMode, ProductType } from './types.js'

export interface MigrationPlan {
  // Nombre del servicio en el compose (sin el slug). Lo usa `docker compose exec`.
  service: 'api'
  // Comandos a ejecutar en orden. Cada uno arranca un proceso nuevo.
  commands: string[][]
  // Si fail-fast: el primer comando que falla detiene la cadena.
  failFast: boolean
}

// Builder que parametriza por modo (demo o producción). El seed sólo
// corre en demo por defecto — en producción es responsabilidad del
// equipo Fluxtic decidir si poblar datos.
function buildSaludPlan(mode: DeploymentMode): MigrationPlan {
  const cmds: string[][] = [
    // prisma generate por si la imagen no fue construida con el cliente
    // generado (idempotente, rápido).
    ['npx', 'prisma', 'generate'],
    // migrate deploy aplica las migraciones pendientes. Es idempotente:
    // si ya están aplicadas no hace nada.
    ['npx', 'prisma', 'migrate', 'deploy'],
  ]
  if (mode === 'demo') {
    cmds.push(['node', 'dist/seed.js'])
  }
  return { service: 'api', commands: cmds, failFast: true }
}

export function migrationPlanFor(product: ProductType, mode: DeploymentMode): MigrationPlan | null {
  switch (product) {
    case 'salud':         return buildSaludPlan(mode)
    case 'beauty':        return null   // pendiente: definir cuando la imagen esté lista
    case 'gastro':        return null
    case 'personalizado': return null
    default:              return null
  }
}
