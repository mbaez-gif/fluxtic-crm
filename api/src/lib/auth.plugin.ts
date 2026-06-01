/**
 * Plugin de autenticacion y autorizacion para Fastify.
 *
 * Decora cada request con `request.user` cuando llega un token valido en
 * `Authorization: Bearer <token>`. Acepta dos formatos:
 *
 *   1. JWT firmado con NEXTAUTH_SECRET (default, emitido por POST /auth/login)
 *   2. `internal:<usuario_id>|<INTERNAL_API_TOKEN>` — fallback server-to-server
 *
 * Expone `requireAuth()` y `requirePermiso(permiso)` en cada request.
 */

import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest } from 'fastify'
import jwt from 'jsonwebtoken'
import type { RolUsuario } from '@prisma/client'
import { prisma } from './prisma'
import { hasPermiso, hasPermisoFlexible, type Permiso } from './policies'

export interface AuthUser {
  id: string
  email: string
  rol: RolUsuario
  nombre: string
  es_profesional: boolean
  es_paciente: boolean
  perfil_profesional_id?: string
  paciente_id?: string
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser
    requireAuth: () => AuthUser
    requirePermiso: (permiso: Permiso, opts?: { flexible?: boolean }) => AuthUser
  }
}

async function loadUser(id: string): Promise<AuthUser | null> {
  const u = await prisma.usuario.findUnique({
    where: { id },
    include: { perfil_profesional: true, paciente: true },
  })
  if (!u || !u.activo) return null
  return {
    id: u.id,
    email: u.email,
    rol: u.rol,
    nombre: u.nombre,
    es_profesional: u.es_profesional,
    es_paciente: u.es_paciente,
    perfil_profesional_id: u.perfil_profesional?.id,
    paciente_id: u.paciente?.id,
  }
}

async function resolveUserFromToken(token: string): Promise<AuthUser | null> {
  if (!token) return null

  // Formato 1: JWT propio firmado con NEXTAUTH_SECRET
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
  if (secret) {
    try {
      const payload = jwt.verify(token, secret) as { id?: string }
      if (payload?.id) return loadUser(payload.id)
    } catch {
      // continua al fallback
    }
  }

  // Formato 2 (fallback server-to-server): "internal:<usuario_id>|<INTERNAL_API_TOKEN>"
  if (token.startsWith('internal:')) {
    const expected = process.env.INTERNAL_API_TOKEN
    if (!expected) return null
    const [, payload] = token.split(':', 2)
    const [usuarioId, providedSecret] = (payload ?? '').split('|')
    if (providedSecret !== expected || !usuarioId) return null
    return loadUser(usuarioId)
  }

  return null
}

async function authPlugin(app: FastifyInstance) {
  app.addHook('onRequest', async (req: FastifyRequest) => {
    const header = req.headers.authorization
    if (header?.startsWith('Bearer ')) {
      const token = header.slice('Bearer '.length).trim()
      req.user = (await resolveUserFromToken(token)) ?? undefined
    }
    req.requireAuth = () => {
      if (!req.user) {
        const err: any = new Error('No autenticado')
        err.statusCode = 401
        throw err
      }
      return req.user
    }
    req.requirePermiso = (permiso: Permiso, opts?: { flexible?: boolean }) => {
      const user = req.requireAuth()
      const check = opts?.flexible ? hasPermisoFlexible : hasPermiso
      if (!check(user.rol, permiso)) {
        const err: any = new Error(`Permiso requerido: ${permiso}`)
        err.statusCode = 403
        throw err
      }
      return user
    }
  })
}

export default fp(authPlugin, { name: 'auth-plugin' })
