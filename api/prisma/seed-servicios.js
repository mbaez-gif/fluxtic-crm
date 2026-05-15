// api/prisma/seed-servicios.js
// Script CommonJS — corre directo con node sin compilar
// Uso: node prisma/seed-servicios.js

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const servicios = [
  { nombre: 'Bblips',              categoria: 'Labios',           duracion_min: 60, precio: 12500 },
  { nombre: 'Manicura francesa',   categoria: 'Manos y pies',     duracion_min: 45, precio: 8500  },
  { nombre: 'Diseño de cejas',     categoria: 'Cejas y pestañas', duracion_min: 30, precio: 6000  },
  { nombre: 'Extensiones',         categoria: 'Cejas y pestañas', duracion_min: 90, precio: 18000 },
  { nombre: 'Nail art',            categoria: 'Manos y pies',     duracion_min: 60, precio: 10000 },
  { nombre: 'Pestañas lifting',    categoria: 'Cejas y pestañas', duracion_min: 60, precio: 9500  },
]

async function main() {
  console.log('Cargando servicios...')
  for (const s of servicios) {
    const r = await prisma.servicio.upsert({
      where:  { nombre: s.nombre },
      update: { precio: s.precio, duracion_min: s.duracion_min },
      create: s,
    })
    console.log(`OK: ${r.nombre} — id: ${r.id}`)
  }
  console.log('Listo.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
