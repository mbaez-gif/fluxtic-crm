/**
 * Endpoint de login validado contra Usuario.password (bcrypt).
 * El frontend (NextAuth) llama a /auth/login con email+password y recibe
 * los datos del usuario para crear la sesion. Auth interno (token Bearer)
 * va por separado en auth.plugin.ts.
 */
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'
import { parseOrFail } from '../lib/zod-helpers'
import { POLICIES } from '../lib/policies'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

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
        descripcion: `Login fallido (password incorrecto)`,
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
    }
  })

  app.get('/auth/me', async (req) => {
    const user = req.requireAuth()
    return { ...user, permisos: POLICIES[user.rol] }
  })
}
