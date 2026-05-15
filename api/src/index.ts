import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import sensible from '@fastify/sensible'

import { prisma } from './lib/prisma'
import authPlugin from './lib/auth.plugin'
import { healthRoutes } from './routes/health'
import { sedesRoutes } from './routes/sedes'
import { especialidadesRoutes } from './routes/especialidades'
import { profesionalesRoutes } from './routes/profesionales'
import { prestacionesRoutes } from './routes/prestaciones'
import { coberturasRoutes } from './routes/coberturas'

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
    .map((o) => o.trim()),
  credentials: true,
})
app.register(helmet, { contentSecurityPolicy: false })
app.register(sensible)
app.register(authPlugin)

app.addHook('preHandler', async (request, reply) => {
  const protectedPaths = ['/webhooks/n8n', '/internal']
  const needsToken = protectedPaths.some((p) => request.url.startsWith(p))
  if (needsToken) {
    const token = request.headers['x-internal-token']
    if (!token || token !== process.env.INTERNAL_API_TOKEN) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Token interno invalido' })
    }
  }
})

// ── Rutas ─────────────────────────────────────────────────────────
app.register(healthRoutes)
app.register(sedesRoutes,          { prefix: '/sedes' })
app.register(especialidadesRoutes, { prefix: '/especialidades' })
app.register(profesionalesRoutes,  { prefix: '/profesionales' })
app.register(prestacionesRoutes,   { prefix: '/prestaciones' })
app.register(coberturasRoutes,     { prefix: '/coberturas' })

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error)
  const statusCode = (error as any).statusCode || 500
  if ((error as any).code === 'P2025') {
    return reply.code(404).send({ error: 'Not found', message: 'Registro no encontrado' })
  }
  if ((error as any).code === 'P2002') {
    return reply.code(409).send({ error: 'Conflict', message: 'Ya existe un registro con ese valor' })
  }
  return reply.code(statusCode).send({
    error: error.name || 'Internal Server Error',
    message: error.message,
  })
})

const start = async () => {
  try {
    await prisma.$connect()
    app.log.info('PostgreSQL conectado')
    await app.listen({ port: parseInt(process.env.PORT || '3001', 10), host: '0.0.0.0' })
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
process.on('SIGINT', shutdown)

start()
