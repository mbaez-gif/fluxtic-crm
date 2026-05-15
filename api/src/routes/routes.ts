// ─────────────────────────────────────────────────────────────────
// src/routes/servicios.ts
// ─────────────────────────────────────────────────────────────────
import { FastifyInstance } from 'fastify'

export async function serviciosRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  app.get('/', async (request) => {
    const { categoria } = request.query as any
    const servicios = await prisma.servicio.findMany({
      where: { activo: true, ...(categoria && { categoria }) },
      include: { insumos: { include: { producto: { select: { id: true, nombre: true } } } } },
      orderBy: { nombre: 'asc' },
    })
    return { data: servicios }
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as any
    const servicio = await prisma.servicio.findUnique({
      where: { id },
      include: { insumos: { include: { producto: true } } },
    })
    if (!servicio) return reply.notFound('Servicio no encontrado')
    return { data: servicio }
  })

  app.post('/', async (request, reply) => {
    const body     = request.body as any
    const servicio = await prisma.servicio.create({ data: body })
    return reply.code(201).send({ data: servicio })
  })

  app.patch('/:id', async (request) => {
    const { id } = request.params as any
    const body   = request.body as any
    const servicio = await prisma.servicio.update({ where: { id }, data: body })
    return { data: servicio }
  })

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as any
    await prisma.servicio.update({ where: { id }, data: { activo: false } })
    return reply.code(204).send()
  })
}


// ─────────────────────────────────────────────────────────────────
// src/routes/productos.ts
// ─────────────────────────────────────────────────────────────────

export async function productosRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  app.get('/', async (request) => {
    const { categoria, solo_criticos } = request.query as any

    const productos = await prisma.producto.findMany({
      where: { activo: true, ...(categoria && { categoria }) },
      orderBy: { nombre: 'asc' },
    })

    const data = solo_criticos === 'true'
      ? productos.filter(p => p.stock_actual <= p.stock_minimo)
      : productos

    return { data, total: data.length }
  })

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as any
    const producto = await prisma.producto.findUnique({
      where: { id },
      include: {
        movimientos: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })
    if (!producto) return reply.notFound('Producto no encontrado')
    return { data: producto }
  })

  app.post('/', async (request, reply) => {
    const body     = request.body as any
    const producto = await prisma.producto.create({ data: body })
    return reply.code(201).send({ data: producto })
  })

  app.patch('/:id', async (request) => {
    const { id } = request.params as any
    const body   = request.body as any
    const producto = await prisma.producto.update({
      where: { id },
      data: { ...body, updatedAt: new Date() },
    })
    return { data: producto }
  })
}


// ─────────────────────────────────────────────────────────────────
// src/routes/stock.ts
// ─────────────────────────────────────────────────────────────────

export async function stockRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  // GET /stock/criticos  ← usado por WF4 (alerta stock) en n8n
  app.get('/criticos', async () => {
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      select: {
        id:             true,
        nombre:         true,
        sku:            true,
        stock_actual:   true,
        stock_minimo:   true,
        categoria:      true,
      },
    })

    const criticos = productos.filter(p => p.stock_actual <= p.stock_minimo)

    return {
      data:  criticos,
      total: criticos.length,
      hay_criticos: criticos.length > 0,
    }
  })

  // POST /stock/ajuste  ← ajuste manual desde el panel
  app.post('/ajuste', async (request, reply) => {
    const { producto_id, cantidad, notas } = request.body as any

    const producto = await prisma.producto.findUnique({ where: { id: producto_id } })
    if (!producto) return reply.notFound('Producto no encontrado')

    const nuevo_stock = producto.stock_actual + cantidad

    await prisma.$transaction([
      prisma.producto.update({
        where: { id: producto_id },
        data: { stock_actual: nuevo_stock, updatedAt: new Date() },
      }),
      prisma.movimientoStock.create({
        data: {
          producto_id,
          tipo:             'AJUSTE_MANUAL',
          cantidad,
          stock_resultante: nuevo_stock,
          notas,
        },
      }),
    ])

    return { data: { producto_id, nuevo_stock } }
  })
}


// ─────────────────────────────────────────────────────────────────
// src/routes/webhooks.ts
// ─────────────────────────────────────────────────────────────────

export async function webhooksRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  // ── Webhooks de n8n (requieren x-internal-token) ───────────────

  // POST /webhooks/n8n/turno-confirmacion-enviada
  app.post('/n8n/turno-confirmacion-enviada', async (request) => {
    const { turno_id, wamid } = request.body as any

    await prisma.$transaction([
      prisma.turno.update({
        where: { id: turno_id },
        data:  { confirmacion_enviada: true, updatedAt: new Date() },
      }),
      prisma.eventoN8n.create({
        data: {
          workflow_name: 'WF1 — Confirmacion de Turno',
          estado:        'EXITOSO',
          mensaje:       `Confirmacion WA enviada. WAMID: ${wamid ?? 'N/A'}`,
          referencia_id: turno_id,
        },
      }),
    ])

    return { ok: true }
  })

  // POST /webhooks/n8n/turno-recordatorio-enviado
  app.post('/n8n/turno-recordatorio-enviado', async (request) => {
    const { turno_id } = request.body as any

    await prisma.turno.update({
      where: { id: turno_id },
      data:  { recordatorio_enviado: true, updatedAt: new Date() },
    })

    return { ok: true }
  })

  // POST /webhooks/n8n/turno-seguimiento-enviado
  app.post('/n8n/turno-seguimiento-enviado', async (request) => {
    const { turno_id } = request.body as any

    await prisma.turno.update({
      where: { id: turno_id },
      data:  { seguimiento_enviado: true, updatedAt: new Date() },
    })

    return { ok: true }
  })

  // ── Webhooks públicos de Meta ──────────────────────────────────

  // GET /webhooks/whatsapp  ← verificación de Meta
  app.get('/whatsapp', async (request, reply) => {
    const q = request.query as any
    if (q['hub.verify_token'] === process.env.WA_WEBHOOK_VERIFY_TOKEN) {
      return reply.code(200).send(q['hub.challenge'])
    }
    return reply.code(403).send({ error: 'Forbidden' })
  })

  // POST /webhooks/whatsapp  ← respuestas SÍ/NO de clientes
  app.post('/whatsapp', async (request, reply) => {
    const body     = request.body as any
    const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages

    // Meta siempre espera 200
    if (!messages?.length) return reply.code(200).send({})

    const msg  = messages[0]
    const from = msg.from as string
    const text = (msg.text?.body ?? '').trim().toUpperCase()

    let nuevoEstado: string | null = null
    if (['SI', 'SÍ', 'S', '1', 'OK'].includes(text)) nuevoEstado = 'CONFIRMADO'
    if (['NO', 'N', '2'].includes(text))              nuevoEstado = 'CANCELADO'

    if (nuevoEstado && from) {
      // Buscar el turno pendiente más próximo del cliente por teléfono
      const turno = await prisma.turno.findFirst({
        where: {
          cliente: { telefono: { endsWith: from.slice(-8) } },
          estado:              'PENDIENTE',
          recordatorio_enviado: true,
        },
        include: { cliente: true },
        orderBy: { fecha: 'asc' },
      })

      if (turno) {
        await prisma.turno.update({
          where: { id: turno.id },
          data:  { estado: nuevoEstado as any, updatedAt: new Date() },
        })

        await prisma.eventoN8n.create({
          data: {
            workflow_name: 'WF2 — Recordatorio 24hs',
            estado:        'EXITOSO',
            mensaje:       `Cliente respondio ${nuevoEstado} al recordatorio. Tel: +${from}`,
            referencia_id: turno.id,
          },
        })
      }
    }

    return reply.code(200).send({})
  })

  // GET /webhooks/instagram  ← verificación de Meta (Sprint 3)
  app.get('/instagram', async (request, reply) => {
    const q = request.query as any
    if (q['hub.verify_token'] === process.env.IG_WEBHOOK_VERIFY_TOKEN) {
      return reply.code(200).send(q['hub.challenge'])
    }
    return reply.code(403).send({ error: 'Forbidden' })
  })

  // POST /webhooks/instagram  ← DMs y comentarios (Sprint 3)
  app.post('/instagram', async (request, reply) => {
    // Por ahora solo loggeamos. Sprint 3 implementa la lógica.
    app.log.info({ body: request.body }, 'Instagram webhook recibido')
    return reply.code(200).send({})
  })
}
