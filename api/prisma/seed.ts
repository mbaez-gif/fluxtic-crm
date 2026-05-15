// api/prisma/seed.ts
// Ejecutar con: npx prisma db seed
// O directamente: node -e con el cliente generado

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // ── Servicios ──────────────────────────────────────────────────
  const servicios = [
    { nombre: 'Bblips',              categoria: 'Labios',           duracion_min: 60, precio: 12500 },
    { nombre: 'Manicura francesa',   categoria: 'Manos y pies',     duracion_min: 45, precio: 8500  },
    { nombre: 'Diseño de cejas',     categoria: 'Cejas y pestañas', duracion_min: 30, precio: 6000  },
    { nombre: 'Extensiones',         categoria: 'Cejas y pestañas', duracion_min: 90, precio: 18000 },
    { nombre: 'Nail art',            categoria: 'Manos y pies',     duracion_min: 60, precio: 10000 },
    { nombre: 'Pestañas lifting',    categoria: 'Cejas y pestañas', duracion_min: 60, precio: 9500  },
  ]

  for (const s of servicios) {
    const result = await prisma.servicio.upsert({
      where:  { nombre: s.nombre },
      update: { precio: s.precio, duracion_min: s.duracion_min },
      create: s,
    })
    console.log(`  ✓ Servicio: ${result.nombre} (${result.id})`)
  }

  console.log('✅ Seed completado')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
