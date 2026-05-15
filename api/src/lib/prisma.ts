/**
 * Singleton de PrismaClient.
 *
 * En desarrollo, Next.js + nodemon hace reload constante y cada reload crea
 * un PrismaClient nuevo, lo que puede dejar conexiones colgadas. Este patrón
 * garantiza una sola instancia por proceso.
 *
 * Uso:
 *   import { prisma } from '../lib/prisma'
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
