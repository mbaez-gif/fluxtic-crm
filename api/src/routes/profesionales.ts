import type { FastifyInstance } from 'fastify'

export async function profesionalesRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  // GET /profesionales — lista de profesionales con campos de comisión
  app.get('/', async (request, reply) => {
    const profesionales = await prisma.usuario.findMany({
      where: {
        activo: true,
        rol: { in: ['OWNER', 'EMPLEADA'] },
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        email: true,
        rol: true,
        color: true,
        tipo_comision: true,
        porcentaje_comision: true,
      },
      orderBy: { nombre: 'asc' },
    })

    return reply.send({
      data: profesionales.map(p => ({
        ...p,
        porcentaje_comision: Number(p.porcentaje_comision),
      })),
      total: profesionales.length,
    })
  })

  // PATCH /profesionales/:id — actualizar comisión del profesional
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as any
    const { tipo_comision, porcentaje_comision } = request.body as any

    const prof = await prisma.usuario.update({
      where: { id },
      data: {
        ...(tipo_comision !== undefined && { tipo_comision }),
        ...(porcentaje_comision !== undefined && { porcentaje_comision: Number(porcentaje_comision) }),
      },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        tipo_comision: true,
        porcentaje_comision: true,
      },
    })

    return reply.send({
      data: {
        ...prof,
        porcentaje_comision: Number(prof.porcentaje_comision),
      },
    })
  })
}
