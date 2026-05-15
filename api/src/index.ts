import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import sensible from '@fastify/sensible'
import { PrismaClient } from '@prisma/client'

import { healthRoutes }    from './routes/health'
import { clientesRoutes }  from './routes/clientes'
import { turnosRoutes }    from './routes/turnos'
import { serviciosRoutes } from './routes/servicios'
import { productosRoutes } from './routes/productos'
import { stockRoutes }     from './routes/stock'
import { webhooksRoutes }  from './routes/webhooks'
import { profesionalesRoutes } from './routes/profesionales'
import { authRoutes }      from './routes/auth'          // ← NUEVO
import { usuariosRoutes }  from './routes/usuarios'
import { ventasRoutes }    from './routes/ventas'
import { reportesRoutes }  from './routes/reportes'
import { disponibilidadRoutes } from './routes/disponibilidad'
import { reservasPublicasRoutes } from './routes/reservas-publicas'
import { pagosRoutes }        from './routes/pagos'
import { whatsappRoutes }     from './routes/whatsapp'
import { dashboardRoutes }    from './routes/dashboard'
import { configuracionRoutes } from './routes/configuracion'
import { pdfRoutes }          from './routes/pdf'
import { notificacionesRoutes } from './routes/notificaciones'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
})

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
})

app.register(cors, {
  origin: (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim()),
  credentials: true,
})

app.register(helmet, { contentSecurityPolicy: false })
app.register(sensible)

app.decorate('prisma', prisma)

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

app.addHook('preHandler', async (request, reply) => {
  const protectedPaths = ['/webhooks/n8n', '/internal']
  const needsToken = protectedPaths.some(p => request.url.startsWith(p))
  if (needsToken) {
    const token = request.headers['x-internal-token']
    if (!token || token !== process.env.INTERNAL_API_TOKEN) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Token interno inválido' })
    }
  }
})

// ── Rutas ─────────────────────────────────────────────────────────
app.register(healthRoutes)
app.register(authRoutes)                                 // ← NUEVO
app.register(clientesRoutes,  { prefix: '/clientes' })
app.register(turnosRoutes,    { prefix: '/turnos' })
app.register(serviciosRoutes, { prefix: '/servicios' })
app.register(productosRoutes, { prefix: '/productos' })
app.register(stockRoutes,     { prefix: '/stock' })
app.register(profesionalesRoutes, { prefix: '/profesionales' })
app.register(webhooksRoutes,  { prefix: '/webhooks' })
app.register(usuariosRoutes,  { prefix: '/usuarios' })
app.register(ventasRoutes,    { prefix: '/ventas' })
app.register(reportesRoutes,  { prefix: '/reportes' })
app.register(disponibilidadRoutes, { prefix: '/disponibilidad' })
app.register(reservasPublicasRoutes, { prefix: '/reservas-publicas' })
app.register(pagosRoutes,        { prefix: '/pagos' })
app.register(whatsappRoutes,     { prefix: '/whatsapp' })
app.register(dashboardRoutes,    { prefix: '/dashboard' })
app.register(configuracionRoutes, { prefix: '/configuracion' })
app.register(pdfRoutes,          { prefix: '/pdf' })
app.register(notificacionesRoutes, { prefix: '/notificaciones' })

app.setErrorHandler((error, request, reply) => {
  app.log.error(error)
  if (error.message?.includes('Record to update not found') ||
      error.message?.includes('No record was found')) {
    return reply.code(404).send({ error: 'Not found', message: 'Registro no encontrado' })
  }
  if ((error as any).code === 'P2002') {
    return reply.code(409).send({ error: 'Conflict', message: 'Ya existe un registro con ese valor' })
  }
  return reply.code(error.statusCode || 500).send({
    error: error.name || 'Internal Server Error',
    message: error.message,
  })
})

const start = async () => {
  try {
    await prisma.$connect()
    app.log.info('PostgreSQL conectado')
    await app.listen({ port: parseInt(process.env.PORT || '3001'), host: '0.0.0.0' })
  } catch (err) {
    app.log.error(err)
    await prisma.$disconnect()
    process.exit(1)
  }
}

const shutdown = async () => {
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT',  shutdown)

start()
