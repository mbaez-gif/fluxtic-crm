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
import { pacientesRoutes } from './routes/pacientes'
import { turnosRoutes } from './routes/turnos'
import { historiaClinicaRoutes } from './routes/historia-clinica'
import { documentosRoutes } from './routes/documentos'
import { facturacionRoutes } from './routes/facturacion'
import { insumosRoutes } from './routes/insumos'
import { auditoriaRoutes } from './routes/auditoria'
import { portalRoutes } from './routes/portal'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboard'
import { webhooksRoutes } from './routes/webhooks'
import { pagosMpRoutes } from './routes/pagos-mp'
import { comunicacionesRoutes } from './routes/comunicaciones'
import { disponibilidadRoutes } from './routes/disponibilidad'
import { reservasPublicasRoutes } from './routes/reservas-publicas'
import { reportesRoutes } from './routes/reportes'
import { pdfRoutes } from './routes/pdf'
import { bloqueosRoutes } from './routes/bloqueos'
import { medicamentosRoutes } from './routes/medicamentos'
import { recetasRoutes } from './routes/recetas'
import { telemedicinaRoutes } from './routes/telemedicina'
import { clinicoRoutes } from './routes/clinico'
import { configuracionRoutes } from './routes/configuracion'
import { operacionesRoutes } from './routes/operaciones'

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

/**
 * Paths que SOLO pueden ser consumidos con x-internal-token.
 * Pensados para n8n / cron jobs. Filtran data privada (telefonos, DNIs,
 * historial de pacientes) por lo que no deben quedar abiertos a internet.
 *
 * Si el header no llega o no coincide con INTERNAL_API_TOKEN, devuelve 401
 * sin tocar el handler.
 */
const INTERNAL_TOKEN_PATHS = [
  '/webhooks/n8n',                          // callbacks n8n -> CRM
  '/internal',                              // futuro: ops internas
  '/comunicaciones/log',                    // n8n loguea WA enviados
  '/comunicaciones/turnos-proximos',        // n8n cron recordatorios
  '/comunicaciones/postconsulta-pendientes',// n8n cron postconsulta
  '/comunicaciones/inactivos-reactivacion', // n8n cron reactivacion
  '/pagos-mp/vencer',                       // n8n cron expiracion (ya validaba dentro del handler; centralizado)
]

app.addHook('preHandler', async (request, reply) => {
  const needsToken = INTERNAL_TOKEN_PATHS.some((p) => request.url.startsWith(p))
  if (needsToken) {
    const token = request.headers['x-internal-token']
    if (!token || token !== process.env.INTERNAL_API_TOKEN) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Token interno requerido' })
    }
  }
})

// ── Rutas ────────────────────────────────────────
app.register(healthRoutes)
app.register(sedesRoutes,          { prefix: '/sedes' })
app.register(especialidadesRoutes, { prefix: '/especialidades' })
app.register(profesionalesRoutes,  { prefix: '/profesionales' })
app.register(prestacionesRoutes,   { prefix: '/prestaciones' })
app.register(coberturasRoutes,     { prefix: '/coberturas' })
app.register(pacientesRoutes,      { prefix: '/pacientes' })
app.register(turnosRoutes,         { prefix: '/turnos' })
app.register(historiaClinicaRoutes,{ prefix: '/historia-clinica' })
app.register(documentosRoutes,     { prefix: '/documentos' })
app.register(facturacionRoutes,    { prefix: '/facturacion' })
app.register(insumosRoutes,        { prefix: '/insumos' })
app.register(auditoriaRoutes,      { prefix: '/auditoria' })
app.register(portalRoutes,         { prefix: '/portal' })
app.register(authRoutes)
app.register(dashboardRoutes,      { prefix: '/dashboard' })
app.register(webhooksRoutes,       { prefix: '/webhooks' })
app.register(pagosMpRoutes,        { prefix: '/pagos-mp' })
app.register(comunicacionesRoutes, { prefix: '/comunicaciones' })
app.register(disponibilidadRoutes, { prefix: '/disponibilidad' })
app.register(reservasPublicasRoutes, { prefix: '/reservas-publicas' })
app.register(reportesRoutes,       { prefix: '/reportes' })
app.register(pdfRoutes,            { prefix: '/pdf' })
app.register(bloqueosRoutes,       { prefix: '/bloqueos' })
app.register(medicamentosRoutes,   { prefix: '/medicamentos' })
app.register(recetasRoutes,        { prefix: '/recetas' })
app.register(telemedicinaRoutes,   { prefix: '/telemedicina' })
app.register(clinicoRoutes,        { prefix: '/clinico' })
app.register(configuracionRoutes,  { prefix: '/configuracion' })
app.register(operacionesRoutes,    { prefix: '/operaciones' })

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
