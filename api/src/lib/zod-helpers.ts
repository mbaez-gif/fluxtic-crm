/**
 * Helpers para validar y manejar respuestas con zod.
 */
import { FastifyReply } from 'fastify'
import { z, ZodError } from 'zod'

export function parseOrFail<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  try {
    return schema.parse(data)
  } catch (err) {
    if (err instanceof ZodError) {
      const e: any = new Error(err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
      e.statusCode = 400
      throw e
    }
    throw err
  }
}

export function notFound(reply: FastifyReply, entity: string) {
  return reply.code(404).send({ error: 'Not found', message: `${entity} no encontrado` })
}

export const idParamSchema = z.object({ id: z.string().min(1) })
