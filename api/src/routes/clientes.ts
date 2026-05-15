import type { FastifyInstance } from 'fastify'

export async function clientesRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  app.get('/', async (request) => {
    const q = (request.query as any)
    const where: any = {}

    if (q.telefono) {
      // Búsqueda exacta por teléfono — para workflows de n8n/IA
      where.telefono = q.telefono
    } else if (q.q) {
      where.OR = [
        { nombre: { contains: q.q, mode: 'insensitive' } },
        { apellido: { contains: q.q, mode: 'insensitive' } },
        { telefono: { contains: q.q } },
        { email: { contains: q.q, mode: 'insensitive' } },
      ]
    }
    if (q.segmento) where.segmento = q.segmento
    if (q.origen)   where.origen   = q.origen
    if (q.activo !== undefined) where.activo = q.activo === 'true'

    const limit  = Math.min(Number(q.limit ?? 50), 200)
    const offset = Number(q.offset ?? 0)

    const [data, total] = await Promise.all([
      prisma.cliente.findMany({
        where,
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        take: limit,
        skip: offset,
      }),
      prisma.cliente.count({ where }),
    ])

    return {
      data: data.map(c => ({
        ...c,
        total_compras: c.total_compras ? Number(c.total_compras) : 0,
      })),
      total,
    }
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const c = await prisma.cliente.findUnique({
      where: { id },
      include: {
        turnos: {
          orderBy: { fecha: 'desc' },
          take: 20,
          include: {
            servicio: { select: { id: true, nombre: true } },
            profesional: { select: { id: true, nombre: true } },
          }
        }
      }
    })
    if (!c) return reply.code(404).send({ error: 'Cliente no encontrado' })
    return {
      ...c,
      total_compras: c.total_compras ? Number(c.total_compras) : 0,
    }
  })

  // GET /clientes/:id/contexto-conversacion — contexto para el asistente IA de WhatsApp
  app.get('/:id/contexto-conversacion', async (request, reply) => {
    const { id } = request.params as { id: string }

    const cliente = await prisma.cliente.findUnique({ where: { id } })
    if (!cliente) return reply.code(404).send({ error: 'Cliente no encontrado' })

    const ahora = new Date()

    const [turnosRecientes, proximoTurno, mensajesRecientes] = await Promise.all([
      prisma.turno.findMany({
        where: { cliente_id: id },
        orderBy: { fecha: 'desc' },
        take: 5,
        select: {
          id: true, fecha: true, estado: true,
          sena: true, monto_total: true, mp_init_point: true,
          servicio:    { select: { nombre: true } },
          profesional: { select: { nombre: true } },
        },
      }),
      prisma.turno.findFirst({
        where: {
          cliente_id: id,
          fecha:  { gte: ahora },
          estado: { in: ['PENDIENTE', 'PENDIENTE_PAGO_MP', 'CONFIRMADO', 'EN_CURSO'] },
        },
        orderBy: { fecha: 'asc' },
        select: {
          id: true, fecha: true, estado: true,
          sena_requerida: true, monto_sena: true, mp_init_point: true,
          reserva_expira_en: true,
          servicio:    { select: { nombre: true, precio: true } },
          profesional: { select: { nombre: true } },
        },
      }),
      prisma.mensajeWA.findMany({
        where: { cliente_id: id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { tipo: true, contenido: true, createdAt: true, estado: true },
      }),
    ])

    // Servicios más usados (de los turnos completados)
    const serviciosMap: Record<string, number> = {}
    turnosRecientes.forEach(t => {
      if (t.servicio?.nombre) {
        serviciosMap[t.servicio.nombre] = (serviciosMap[t.servicio.nombre] ?? 0) + 1
      }
    })
    const top_servicios = Object.entries(serviciosMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))

    return {
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        apellido: cliente.apellido,
        telefono: cliente.telefono,
        segmento: cliente.segmento,
        cant_turnos: cliente.cant_turnos,
        ultimo_turno: cliente.ultimo_turno,
        notas: cliente.notas,
      },
      proximo_turno: proximoTurno ? {
        id: proximoTurno.id,
        fecha: proximoTurno.fecha,
        estado: proximoTurno.estado,
        servicio: proximoTurno.servicio.nombre,
        profesional: proximoTurno.profesional.nombre,
        sena_requerida: proximoTurno.sena_requerida,
        monto_sena: proximoTurno.monto_sena ? Number(proximoTurno.monto_sena) : null,
        link_pago: proximoTurno.mp_init_point ?? null,
        expira_en: proximoTurno.reserva_expira_en,
      } : null,
      turnos_recientes: turnosRecientes.map(t => ({
        id: t.id,
        fecha: t.fecha,
        estado: t.estado,
        servicio: t.servicio.nombre,
        profesional: t.profesional.nombre,
        sena_pagada: t.sena ? Number(t.sena) : null,
        total: Number(t.monto_total),
      })),
      top_servicios,
      ultimo_mensaje_wa: mensajesRecientes[0] ?? null,
    }
  })

  app.post('/', async (request, reply) => {
    const body = request.body as any
    if (!body.nombre) return reply.code(400).send({ error: 'El nombre es obligatorio' })

    // Verificar duplicado por teléfono o email
    if (body.telefono) {
      const existe = await prisma.cliente.findFirst({ where: { telefono: body.telefono } })
      if (existe) return reply.code(409).send({ error: 'Ya existe un cliente con ese teléfono' })
    }
    if (body.email) {
      const existe = await prisma.cliente.findFirst({ where: { email: body.email } })
      if (existe) return reply.code(409).send({ error: 'Ya existe un cliente con ese email' })
    }

    const cliente = await prisma.cliente.create({
      data: {
        nombre:   body.nombre,
        apellido: body.apellido ?? '',
        telefono: body.telefono ?? null,
        email:    body.email ?? null,
        segmento: body.segmento ?? 'FINAL',
        origen:   body.origen ?? 'MANUAL',
        notas:    body.notas ?? null,
        activo:   true,
      },
    })
    return reply.code(201).send({
      ...cliente,
      total_compras: Number(cliente.total_compras),
    })
  })

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as any

    const existe = await prisma.cliente.findUnique({ where: { id } })
    if (!existe) return reply.code(404).send({ error: 'Cliente no encontrado' })

    // Verificar duplicados si cambia teléfono/email
    if (body.telefono && body.telefono !== existe.telefono) {
      const dup = await prisma.cliente.findFirst({ where: { telefono: body.telefono, NOT: { id } } })
      if (dup) return reply.code(409).send({ error: 'Ya existe un cliente con ese teléfono' })
    }
    if (body.email && body.email !== existe.email) {
      const dup = await prisma.cliente.findFirst({ where: { email: body.email, NOT: { id } } })
      if (dup) return reply.code(409).send({ error: 'Ya existe un cliente con ese email' })
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...(body.nombre    !== undefined && { nombre: body.nombre }),
        ...(body.apellido  !== undefined && { apellido: body.apellido }),
        ...(body.telefono  !== undefined && { telefono: body.telefono }),
        ...(body.email     !== undefined && { email: body.email }),
        ...(body.segmento  !== undefined && { segmento: body.segmento }),
        ...(body.origen    !== undefined && { origen: body.origen }),
        ...(body.notas     !== undefined && { notas: body.notas }),
        ...(body.activo    !== undefined && { activo: body.activo }),
      },
    })
    return {
      ...cliente,
      total_compras: Number(cliente.total_compras),
    }
  })

  // DELETE /clientes/:id — soft delete (nunca borrar si tiene turnos)
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: { _count: { select: { turnos: true } } }
    })
    if (!cliente) return reply.code(404).send({ error: 'Cliente no encontrado' })

    if (cliente._count.turnos > 0) {
      // Tiene turnos — solo desactivar
      await prisma.cliente.update({ where: { id }, data: { activo: false } })
      return reply.send({ ok: true, tipo: 'desactivado', mensaje: `Cliente desactivada (tiene ${cliente._count.turnos} turno(s))` })
    }

    // Sin turnos — eliminar real
    await prisma.cliente.delete({ where: { id } })
    return reply.send({ ok: true, tipo: 'eliminado' })
  })
}
