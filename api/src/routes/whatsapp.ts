import type { FastifyInstance } from 'fastify'

export async function whatsappRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  // ── Configuración ─────────────────────────────────────────────────

  // GET /whatsapp/config
  app.get('/config', async () => {
    const integracion = await prisma.integracion.findUnique({ where: { nombre: 'whatsapp' } })
    if (!integracion) {
      return {
        activa: false,
        config: {
          confirmacion_activa: true,
          recordatorio_activa: true,
          cumpleanos_activa: true,
          horas_antes_recordatorio: 24,
          plantilla_confirmacion: 'Hola {{nombre}} 👋 Tu turno para *{{servicio}}* está confirmado para el *{{fecha}}* a las *{{hora}}* con {{profesional}}. ¡Te esperamos!',
          plantilla_recordatorio: 'Hola {{nombre}} 😊 Te recordamos que mañana tenés turno para *{{servicio}}* a las *{{hora}}* con {{profesional}}. Respondé *SÍ* para confirmar o *NO* para cancelar.',
          plantilla_cumpleanos: '🎉 ¡Feliz cumpleaños {{nombre}}! Desde el equipo de Delfina Paz Beauty te deseamos un día increíble. ¡Tenemos un regalo especial para vos!',
        }
      }
    }
    return { activa: integracion.activa, config: integracion.config }
  })

  // PUT /whatsapp/config
  app.put('/config', async (request) => {
    const body = request.body as any
    const integracion = await prisma.integracion.upsert({
      where: { nombre: 'whatsapp' },
      create: { nombre: 'whatsapp', activa: body.activa ?? true, config: body.config ?? {} },
      update: { activa: body.activa ?? true, config: body.config ?? {}, updatedAt: new Date() },
    })
    return { data: integracion }
  })

  // ── Turnos próximos para n8n ──────────────────────────────────────

  // GET /whatsapp/turnos-proximos?horas=24
  // n8n llama este endpoint para saber qué turnos necesitan recordatorio
  app.get('/turnos-proximos', async (request) => {
    const q = request.query as any
    const horas = parseInt(q.horas ?? '24')

    const ahora = new Date()
    const limite = new Date(ahora.getTime() + horas * 60 * 60 * 1000)
    const desde = new Date(ahora.getTime() + (horas - 2) * 60 * 60 * 1000)

    const turnos = await prisma.turno.findMany({
      where: {
        fecha: { gte: desde, lte: limite },
        estado: { in: ['PENDIENTE', 'CONFIRMADO'] },
        recordatorio_enviado: false,
        cliente: { telefono: { not: null } },
      },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
        servicio: { select: { nombre: true } },
        profesional: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fecha: 'asc' },
    })

    return {
      data: turnos.map(t => ({
        id: t.id,
        fecha: t.fecha.toISOString(),
        cliente_id: t.cliente_id,
        cliente_nombre: `${t.cliente.nombre} ${t.cliente.apellido ?? ''}`.trim(),
        cliente_telefono: t.cliente.telefono,
        servicio: t.servicio.nombre,
        profesional: `${t.profesional.nombre} ${t.profesional.apellido ?? ''}`.trim(),
      })),
      total: turnos.length,
    }
  })

  // GET /whatsapp/turnos-sin-confirmar
  // n8n llama este endpoint para enviar confirmaciones de turnos nuevos
  app.get('/turnos-sin-confirmar', async () => {
    const hace15min = new Date(Date.now() - 15 * 60 * 1000)

    const turnos = await prisma.turno.findMany({
      where: {
        confirmacion_enviada: false,
        estado: { in: ['PENDIENTE', 'CONFIRMADO'] },
        createdAt: { lte: hace15min },
        cliente: { telefono: { not: null } },
      },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, telefono: true } },
        servicio: { select: { nombre: true } },
        profesional: { select: { nombre: true, apellido: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    })

    return {
      data: turnos.map(t => ({
        id: t.id,
        fecha: t.fecha.toISOString(),
        cliente_id: t.cliente_id,
        cliente_nombre: `${t.cliente.nombre} ${t.cliente.apellido ?? ''}`.trim(),
        cliente_telefono: t.cliente.telefono,
        servicio: t.servicio.nombre,
        profesional: `${t.profesional.nombre} ${t.profesional.apellido ?? ''}`.trim(),
      })),
      total: turnos.length,
    }
  })

  // ── Cumpleaños para n8n ───────────────────────────────────────────

  // GET /whatsapp/cumpleanos-hoy
  // n8n llama este endpoint cada mañana para saber a quién saludar
  app.get('/cumpleanos-hoy', async () => {
    const hoy = new Date()
    const mes = hoy.getMonth() + 1
    const dia = hoy.getDate()

    // Busca clientes cuyo mes y día de nacimiento coincidan con hoy
    const clientes = await prisma.cliente.findMany({
      where: {
        fecha_nacimiento: { not: null },
        activo: true,
        telefono: { not: null },
      },
      select: {
        id: true, nombre: true, apellido: true,
        telefono: true, fecha_nacimiento: true,
      },
    })

    const cumpleaneros = clientes.filter(c => {
      if (!c.fecha_nacimiento) return false
      const fn = new Date(c.fecha_nacimiento)
      return fn.getMonth() + 1 === mes && fn.getDate() === dia
    })

    return {
      data: cumpleaneros.map(c => ({
        id: c.id,
        nombre: `${c.nombre} ${c.apellido ?? ''}`.trim(),
        telefono: c.telefono,
      })),
      total: cumpleaneros.length,
      fecha: hoy.toISOString().split('T')[0],
    }
  })

  // ── Log de mensajes enviados (llamado por n8n) ────────────────────

  // POST /whatsapp/log
  app.post('/log', async (request, reply) => {
    const body = request.body as any
    const { cliente_id, telefono, tipo, contenido, turno_id, sid, error } = body

    const msg = await prisma.mensajeWA.create({
      data: {
        cliente_id: cliente_id ?? null,
        telefono,
        tipo,
        estado: error ? 'FALLIDO' : 'ENVIADO',
        contenido,
        turno_id: turno_id ?? null,
        sid: sid ?? null,
        error: error ?? null,
      },
    })

    // Si es confirmación o recordatorio, marcar el turno
    if (turno_id && !error) {
      if (tipo === 'CONFIRMACION') {
        await prisma.turno.update({
          where: { id: turno_id },
          data: { confirmacion_enviada: true, updatedAt: new Date() },
        })
      }
      if (tipo === 'RECORDATORIO') {
        await prisma.turno.update({
          where: { id: turno_id },
          data: { recordatorio_enviado: true, updatedAt: new Date() },
        })
      }
      if (tipo === 'SEGUIMIENTO') {
        await prisma.turno.update({
          where: { id: turno_id },
          data: { seguimiento_enviado: true, updatedAt: new Date() },
        })
      }
    }

    return reply.code(201).send({ data: msg })
  })

  // ── Historial ─────────────────────────────────────────────────────

  // GET /whatsapp/historial?page=1&limit=50&tipo=RECORDATORIO
  app.get('/historial', async (request) => {
    const q = request.query as any
    const page = parseInt(q.page ?? '1')
    const limit = parseInt(q.limit ?? '50')
    const skip = (page - 1) * limit

    const where: any = {}
    if (q.tipo) where.tipo = q.tipo
    if (q.estado) where.estado = q.estado

    const [total, mensajes] = await Promise.all([
      prisma.mensajeWA.count({ where }),
      prisma.mensajeWA.findMany({
        where,
        include: { cliente: { select: { nombre: true, apellido: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return { data: mensajes, total, page, limit }
  })

  // ── Envío de prueba ───────────────────────────────────────────────

  // POST /whatsapp/prueba
  // El frontend llama esto; la API registra la prueba y retorna el payload
  // que n8n usaría (el envío real lo hace n8n con Twilio)
  app.post('/prueba', async (request, reply) => {
    const { telefono, mensaje } = request.body as any

    if (!telefono || !mensaje) {
      return reply.badRequest('telefono y mensaje son requeridos')
    }

    const msg = await prisma.mensajeWA.create({
      data: {
        telefono,
        tipo: 'PRUEBA',
        estado: 'PENDIENTE',
        contenido: mensaje,
      },
    })

    return reply.code(201).send({
      data: msg,
      n8n_payload: { telefono, mensaje, mensaje_id: msg.id },
    })
  })

  // ── Stats rápidas para el dashboard WA ───────────────────────────

  // GET /whatsapp/stats
  app.get('/stats', async () => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    const [totalHoy, fallidos, confirmaciones, recordatorios, cumpleanos] = await Promise.all([
      prisma.mensajeWA.count({ where: { createdAt: { gte: hoy } } }),
      prisma.mensajeWA.count({ where: { estado: 'FALLIDO', createdAt: { gte: hoy } } }),
      prisma.mensajeWA.count({ where: { tipo: 'CONFIRMACION', createdAt: { gte: hoy } } }),
      prisma.mensajeWA.count({ where: { tipo: 'RECORDATORIO', createdAt: { gte: hoy } } }),
      prisma.mensajeWA.count({ where: { tipo: 'CUMPLEANOS', createdAt: { gte: hoy } } }),
    ])

    return { hoy: { total: totalHoy, fallidos, confirmaciones, recordatorios, cumpleanos } }
  })
}
