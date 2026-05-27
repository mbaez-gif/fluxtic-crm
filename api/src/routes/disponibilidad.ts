/**
 * GET /disponibilidad
 *
 * Endpoint público (sin auth) para que el portal del paciente y los workflows
 * de n8n consulten slots disponibles.
 */
import type { FastifyInstance } from 'fastify'
import { calcularDisponibilidad } from '../services/disponibilidad.service'

export async function disponibilidadRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const q = request.query as Record<string, string>

    if (!q.prestacion_id) {
      return reply.code(400).send({ error: 'Bad request', message: 'prestacion_id es requerido' })
    }
    if (!q.fecha_desde || !q.fecha_hasta) {
      return reply.code(400).send({ error: 'Bad request', message: 'fecha_desde y fecha_hasta son requeridos' })
    }

    const fechaDesde = parsearFechaLocal(q.fecha_desde)
    const fechaHasta = parsearFechaLocal(q.fecha_hasta)
    if (!fechaDesde || !fechaHasta) {
      return reply.code(400).send({ error: 'Bad request', message: 'Fechas inválidas (esperado YYYY-MM-DD o ISO)' })
    }

    try {
      const r = await calcularDisponibilidad({
        prestacion_id: q.prestacion_id,
        profesional_id: q.profesional_id,
        sede_id: q.sede_id,
        especialidad_id: q.especialidad_id,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        granularidad_min: q.granularidad_min ? parseInt(q.granularidad_min, 10) : undefined,
      })
      return r
    } catch (err: any) {
      return reply.code(err.statusCode ?? 500).send({ error: 'Error', message: err.message })
    }
  })
}

function parsearFechaLocal(raw: string): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    return new Date(y, m - 1, d, 0, 0, 0, 0)
  }
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}
