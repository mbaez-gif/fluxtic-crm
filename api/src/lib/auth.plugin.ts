/**
 * Plugin de autenticacion y autorizacion para Fastify.
 *
 * Decora cada request con `request.user` cuando llega un token valido en
 * `Authorization: Bearer <token>` o en la cookie de sesion. Si no hay token,
 * la ruta queda accesible salvo que el handler llame a `requireAuth()`.
 *
 * Tambien expone `requirePermiso(permiso)` para chequeo de policies.
 */

import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest } from 'fastify'
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

async function resolveUserFromToken(token: string): Promise<AuthUser | null> {
  // En Etapa 1 el token es un JWT generado por NextAuth (frontend) firmado con
  // NEXTAUTH_SECRET. Para evitar acoplar el plugin a la libreria de NextAuth,
  // aceptamos tambien un fallback: token directo = usuario_id firmado por
  // INTERNAL_API_TOKEN. La validacion real con JWT vive en C07/C08.
  if (!token) return null

  // Fallback simple: token = "internal:<usuario_id>" usando INTERNAL_API_TOKEN
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
