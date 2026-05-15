/**
 * PrismaClient con extension de soft-delete para entidades clinicas.
 *
 * Modelos con soft-delete: cualquier model con campo `deleted_at`.
 *   - findMany/findFirst/findUnique/count -> agregan `deleted_at: null` salvo
 *     que se pase `where: { ...,  __includeDeleted: true }`.
 *   - delete/deleteMany -> reescritos a update con `deleted_at = now()`.
 *
 * Para forzar borrado fisico (raro, solo para limpieza de testing) usar
 * `prisma.$executeRaw` directo.
 */

import { Prisma, PrismaClient } from '@prisma/client'

const SOFT_DELETE_MODELS = new Set([
  'Paciente',
  'Turno',
  'EvolucionClinica',
  'Antecedente',
  'Alergia',
  'MedicacionHabitual',
  'Diagnostico',
  'Indicacion',
  'Estudio',
  'DocumentoClinico',
  'Consentimiento',
  'Comprobante',
  'Pago',
  'Insumo',
])

type WhereWithFlag = Record<string, unknown> & { __includeDeleted?: boolean }

function withSoftDeleteFilter(args: any) {
  const where = (args?.where ?? {}) as WhereWithFlag
  if (where.__includeDeleted) {
    const { __includeDeleted, ...rest } = where
    return { ...args, where: rest }
  }
  return {
    ...args,
    where: {
      ...where,
      deleted_at: where.deleted_at ?? null,
    },
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof buildPrisma> | undefined
}

function buildPrisma() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

  return base.$extends({
    name: 'soft-delete',
    query: {
      $allModels: {
        async findFirst({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) return query(withSoftDeleteFilter(args))
          return query(args)
        },
        async findFirstOrThrow({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) return query(withSoftDeleteFilter(args))
          return query(args)
        },
        async findMany({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) return query(withSoftDeleteFilter(args))
          return query(args)
        },
        async findUnique({ model, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model)) return query(args)
          const result = await query(args)
          if (result && (result as any).deleted_at !== null) return null
          return result
        },
        async count({ model, args, query }) {
          if (SOFT_DELETE_MODELS.has(model)) return query(withSoftDeleteFilter(args ?? {}))
          return query(args)
        },
        async delete({ model, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model)) return query(args)
          const ctx = (args as any).__softDeleteContext as
            | { usuario_id?: string; motivo?: string }
            | undefined
          return (base as any)[model[0].toLowerCase() + model.slice(1)].update({
            where: args.where,
            data: {
              deleted_at: new Date(),
              deleted_by: ctx?.usuario_id ?? null,
              motivo_eliminacion: ctx?.motivo ?? null,
            },
          })
        },
        async deleteMany({ model, args, query }) {
          if (!SOFT_DELETE_MODELS.has(model)) return query(args)
          return (base as any)[model[0].toLowerCase() + model.slice(1)].updateMany({
            where: { ...(args.where ?? {}), deleted_at: null },
            data: { deleted_at: new Date() },
          })
        },
      },
    },
  })
}

export const prisma =
  globalForPrisma.prisma ??
  buildPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export { Prisma }

/**
 * Helper para borrado lógico con contexto de auditoría.
 * Reescribe el args.where para incluir motivo y usuario_id.
 */
export function softDeleteArgs(opts: {
  where: Prisma.JsonObject
  usuario_id?: string
  motivo?: string
}) {
  return {
    where: opts.where,
    __softDeleteContext: { usuario_id: opts.usuario_id, motivo: opts.motivo },
  } as any
}
