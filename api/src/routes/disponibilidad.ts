/**
 * Route: GET /disponibilidad
 *
 * Endpoint público (no requiere auth) para consultar slots disponibles.
 * Lo usa el link público de reservas y los workflows de n8n.
 */

import type { FastifyInstance } from 'fastify'
import { calcularDisponibilidad } from '../services/disponibilidad.service'
import { handleError } from '../utils/http-errors'

export async function disponibilidadRoutes(fastify: FastifyInstance) {
  /**
   * GET /disponibilidad
   *
   * Query params:
   *   - servicio_id (requerido)
   *   - profesional_id (opcional — si no se pasa, calcula para todas)
   *   - fecha_desde (requerido — ISO 8601 o YYYY-MM-DD)
   *   - fecha_hasta (requerido — ISO 8601 o YYYY-MM-DD)
   *   - granularidad_min (opcional — default 30)
   *
   * Response:
   *   {
   *     servicio: { id, nombre, duracion_min, buffer_min, precio },
   *     por_profesional: [
   *       {
   *         profesional_id, profesional_nombre,
   *         slots: [ { inicio, fin } ]
   *       }
   *     ]
   *   }
   */
  fastify.get('/', async (request, reply) => {
    try {
      const q = request.query as Record<string, string>

      if (!q.servicio_id) {
        return reply.code(400).send({ error: 'servicio_id es requerido' })
      }
      if (!q.fecha_desde || !q.fecha_hasta) {
        return reply.code(400).send({ error: 'fecha_desde y fecha_hasta son requeridos' })
      }

      const fechaDesde = parsearFechaLocal(q.fecha_desde)
      const fechaHasta = parsearFechaLocal(q.fecha_hasta)

      if (!fechaDesde || !fechaHasta) {
        return reply.code(400).send({ error: 'Fechas inválidas (formato esperado: YYYY-MM-DD)' })
      }

      if (fechaHasta < fechaDesde) {
        return reply.code(400).send({ error: 'fecha_hasta debe ser >= fecha_desde' })
      }

      // Limitar el rango para evitar queries gigantes
      const diffDays = (fechaHasta.getTime() - fechaDesde.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays > 60) {
        return reply.code(400).send({ error: 'Rango máximo de 60 días' })
      }

      const result = await calcularDisponibilidad({
        servicio_id: q.servicio_id,
        profesional_id: q.profesional_id || undefined,
        fecha_desde: fechaDesde,
        fecha_hasta: fechaHasta,
        granularidad_min: q.granularidad_min ? parseInt(q.granularidad_min, 10) : undefined,
      })

      return reply.send(result)
    } catch (err) {
      handleError(err, reply)
    }
  })
}

/**
 * Parsea una fecha en formato YYYY-MM-DD como medianoche en la TZ local del proceso.
 * Si el server corre en Argentina (TZ=America/Argentina/Buenos_Aires), esto
 * garantiza que getDay() y setHours() trabajen sobre la fecha esperada.
 *
 * Acepta tambien ISO 8601 completo si viene con tiempo.
 */
function parsearFechaLocal(s: string | undefined): Date | null {
  if (!s) return null
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (soloFecha) {
    const [, y, m, d] = soloFecha
    const dt = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0)
    return isNaN(dt.getTime()) ? null : dt
  }
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? null : dt
}
