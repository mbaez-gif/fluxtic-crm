/**
 * Helpers para errores HTTP consistentes.
 *
 * Patrón: throw new HttpError(status, message, code)
 * Los routes los convierten en respuestas HTTP en su error handler.
 */

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export const errors = {
  badRequest: (message: string, code?: string, details?: unknown) =>
    new HttpError(400, message, code, details),
  unauthorized: (message = 'No autorizado') =>
    new HttpError(401, message, 'UNAUTHORIZED'),
  forbidden: (message = 'Acceso denegado') =>
    new HttpError(403, message, 'FORBIDDEN'),
  notFound: (resource: string) =>
    new HttpError(404, `${resource} no encontrado`, 'NOT_FOUND'),
  conflict: (message: string, code?: string) =>
    new HttpError(409, message, code || 'CONFLICT'),
  unprocessable: (message: string, code?: string, details?: unknown) =>
    new HttpError(422, message, code, details),
  internal: (message = 'Error interno del servidor') =>
    new HttpError(500, message, 'INTERNAL_ERROR'),
  badGateway: (message: string) =>
    new HttpError(502, message, 'BAD_GATEWAY'),
  serviceUnavailable: (message: string) =>
    new HttpError(503, message, 'SERVICE_UNAVAILABLE'),
}

/**
 * Helper para usar en handlers de Fastify.
 * Convierte HttpError en respuesta HTTP. Otras excepciones → 500.
 *
 * Tambien acepta errores plain que tengan .statusCode pegado, para no
 * romper codigo legacy que lance Error con properties manuales.
 */
export function handleError(error: unknown, reply: any): void {
  if (error instanceof HttpError) {
    reply.code(error.statusCode).send({
      error: error.code || error.message,
      message: error.message,
      details: error.details,
    })
    return
  }

  // Errores con shape de HttpError pero sin instanceof (legacy code)
  if (
    error &&
    typeof error === 'object' &&
    'statusCode' in error &&
    typeof (error as { statusCode: unknown }).statusCode === 'number'
  ) {
    const e = error as { statusCode: number; code?: string; message?: string; details?: unknown }
    reply.code(e.statusCode).send({
      error: e.code || e.message || 'Error',
      message: e.message,
      details: e.details,
    })
    return
  }

  console.error('[error] no manejado:', error)
  const message = error instanceof Error ? error.message : String(error)
  reply.code(500).send({
    error: 'INTERNAL_ERROR',
    message: 'Error interno del servidor',
    details: process.env.NODE_ENV === 'development' ? message : undefined,
  })
}
