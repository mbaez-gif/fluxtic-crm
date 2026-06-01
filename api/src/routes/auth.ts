/**
 * Auth endpoint:
 *   POST /auth/login  → valida credenciales (bcrypt), audita LOGIN/ACCESO_DENEGADO,
 *                       y devuelve { ...user, token } donde `token` es un JWT firmado
 *                       con NEXTAUTH_SECRET (compartido con el frontend NextAuth).
 *   GET  /auth/me     → devuelve el usuario actual desde el JWT del header.
 *
 * El token tiene 8h de duración. El frontend lo persiste vía NextAuth
 * y lo envía al backend en `Authorization: Bearer <token>` desde apiFetch.
 */
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { parseOrFail } from '../lib/zod-helpers'
import { POLICIES } from '../lib/policies'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const TOKEN_TTL_SECONDS = 8 * 60 * 60 // 8 horas

function signToken(payload: { id: string; email: string; rol: string }): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET (o JWT_SECRET) no esta configurado. Imposible firmar token.')
  }
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL_SECONDS })
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const { email, password } = parseOrFail(loginSchema, req.body)
    const u = await prisma.usuario.findUnique({
      where: { email },
      include: { perfil_profesional: true, paciente: true },
    })
    if (!u || !u.activo) {
      await writeAudit({
        usuario_id: null,
        accion: 'ACCESO_DENEGADO',
        entidad: 'Usuario',
        descripcion: `Login fallido (no existe o inactivo): ${email}`,
        ...auditMetaFromRequest(req),
      })
      return reply.code(401).send({ error: 'Unauthorized', message: 'Credenciales invalidas' })
    }
    const ok = await bcrypt.compare(password, u.password)
    if (!ok) {
      await writeAudit({
        usuario_id: u.id,
        accion: 'ACCESO_DENEGADO',
        entidad: 'Usuario',
        descripcion: 'Login fallido (password incorrecto)',
        ...auditMetaFromRequest(req),
      })
      return reply.code(401).send({ error: 'Unauthorized', message: 'Credenciales invalidas' })
    }
    await prisma.usuario.update({ where: { id: u.id }, data: { ultimo_login: new Date() } })
    await writeAudit({
      usuario_id: u.id,
      accion: 'LOGIN',
      entidad: 'Usuario',
      entidad_id: u.id,
      ...auditMetaFromRequest(req),
    })

    const token = signToken({ id: u.id, email: u.email, rol: u.rol })

    return {
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      rol: u.rol,
      es_profesional: u.es_profesional,
      es_paciente: u.es_paciente,
      perfil_profesional_id: u.perfil_profesional?.id ?? null,
      paciente_id: u.paciente?.id ?? null,
      permisos: POLICIES[u.rol],
      token,
      expires_in: TOKEN_TTL_SECONDS,
    }
  })

  app.get('/auth/me', async (req) => {
    const user = req.requireAuth()
    return { ...user, permisos: POLICIES[user.rol] }
  })
}
