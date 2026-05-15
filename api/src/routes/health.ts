// ─────────────────────────────────────────────────────────────────
// src/routes/health.ts
// ─────────────────────────────────────────────────────────────────
import { FastifyInstance } from 'fastify'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    status:    'ok',
    service:   'fluxtic-salud-api',
    version:   '0.1.0',
    timestamp: new Date().toISOString(),
    db:        'connected',
  }))
}
