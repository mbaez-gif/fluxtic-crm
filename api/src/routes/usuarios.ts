import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { PrismaClient, RolUsuario } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

interface CreateUsuarioBody {
  nombre: string
  apellido: string
  email: string
  password: string
  rol: RolUsuario
  color?: string
  telefono?: string
}

interface UpdateUsuarioBody {
  nombre?: string
  apellido?: string
  email?: string
  rol?: 'OWNER' | 'ADMIN' | 'EMPLEADA'
  activo?: boolean
  color?: string
  telefono?: string
  // Permisos
  puede_ver_caja?: boolean
  puede_cobrar?: boolean
  puede_anular_ventas?: boolean
  puede_reimprimir_comprobantes?: boolean
  puede_ver_ventas_dia?: boolean
  puede_ver_reportes?: boolean
  puede_gestionar_turnos?: boolean
  puede_gestionar_clientes?: boolean
  puede_gestionar_servicios?: boolean
  puede_gestionar_productos?: boolean
  puede_gestionar_configuracion?: boolean
  puede_gestionar_usuarios?: boolean
  puede_gestionar_integraciones?: boolean
}

interface CambiarPasswordBody {
  password_actual?: string
  password_nueva: string
}

interface UsuarioParams {
  id: string
}

export async function usuariosRoutes(fastify: FastifyInstance) {
  // GET /usuarios — listar todos
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const usuarios = await prisma.usuario.findMany({
        orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
        select: {
          id: true, nombre: true, apellido: true, email: true,
          rol: true, activo: true, color: true, telefono: true, createdAt: true,
          puede_ver_caja: true, puede_cobrar: true, puede_anular_ventas: true,
          puede_reimprimir_comprobantes: true, puede_ver_ventas_dia: true,
          puede_ver_reportes: true, puede_gestionar_turnos: true,
          puede_gestionar_clientes: true, puede_gestionar_servicios: true,
          puede_gestionar_productos: true, puede_gestionar_configuracion: true,
          puede_gestionar_usuarios: true, puede_gestionar_integraciones: true,
          _count: { select: { turnos: true } }
        }
      })
      return reply.send({ data: usuarios })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Error al obtener usuarios' })
    }
  })

  // POST /usuarios — crear usuario/profesional
  fastify.post('/', async (req: FastifyRequest<{ Body: CreateUsuarioBody }>, reply: FastifyReply) => {
    const { nombre, apellido, email, password, rol, color, telefono } = req.body

    if (!nombre || !apellido || !email || !password || !rol) {
      return reply.status(400).send({ error: 'Faltan campos obligatorios' })
    }

    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!emailValido) {
      return reply.status(400).send({ error: 'Email inválido' })
    }

    if (password.length < 6) {
      return reply.status(400).send({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    try {
      const existe = await prisma.usuario.findUnique({ where: { email } })
      if (existe) {
        return reply.status(409).send({ error: 'Ya existe un usuario con ese email' })
      }

      const hash = await bcrypt.hash(password, 12)
      const permisosDefecto = permisosParaRol(rol)
      const usuario = await prisma.usuario.create({
        data: {
          nombre, apellido, email,
          password: hash, rol,
          color: color ?? generarColor(),
          telefono: telefono ?? null,
          activo: true,
          ...permisosDefecto,
        },
        select: selectUsuario,
      })
      return reply.status(201).send(usuario)
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Error al crear usuario' })
    }
  })

  // PATCH /usuarios/:id — actualizar datos
  fastify.patch('/:id', async (
    req: FastifyRequest<{ Params: UsuarioParams; Body: UpdateUsuarioBody }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const body = req.body

    try {
      const existe = await prisma.usuario.findUnique({ where: { id } })
      if (!existe) return reply.status(404).send({ error: 'Usuario no encontrado' })

      if (body.email && body.email !== existe.email) {
        const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)
        if (!emailValido) return reply.status(400).send({ error: 'Email inválido' })
        const ocupado = await prisma.usuario.findFirst({ where: { email: body.email, NOT: { id } } })
        if (ocupado) return reply.status(409).send({ error: 'Email ya en uso' })
      }

      const PERMISOS_KEYS = [
        'puede_ver_caja', 'puede_cobrar', 'puede_anular_ventas',
        'puede_reimprimir_comprobantes', 'puede_ver_ventas_dia', 'puede_ver_reportes',
        'puede_gestionar_turnos', 'puede_gestionar_clientes', 'puede_gestionar_servicios',
        'puede_gestionar_productos', 'puede_gestionar_configuracion',
        'puede_gestionar_usuarios', 'puede_gestionar_integraciones',
      ] as const

      const permisosUpdate: Record<string, boolean> = {}
      for (const k of PERMISOS_KEYS) {
        if (body[k] !== undefined) permisosUpdate[k] = body[k] as boolean
      }

      const actualizado = await prisma.usuario.update({
        where: { id },
        data: {
          ...(body.nombre    !== undefined && { nombre: body.nombre }),
          ...(body.apellido  !== undefined && { apellido: body.apellido }),
          ...(body.email     !== undefined && { email: body.email }),
          ...(body.rol       !== undefined && { rol: body.rol }),
          ...(body.activo    !== undefined && { activo: body.activo }),
          ...(body.color     !== undefined && { color: body.color }),
          ...(body.telefono  !== undefined && { telefono: body.telefono }),
          ...permisosUpdate,
        },
        select: selectUsuario,
      })
      return reply.send(actualizado)
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Error al actualizar usuario' })
    }
  })

  // PATCH /usuarios/:id/password — cambiar contraseña
  fastify.patch('/:id/password', async (
    req: FastifyRequest<{ Params: UsuarioParams; Body: CambiarPasswordBody }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const { password_actual, password_nueva } = req.body

    if (!password_nueva || password_nueva.length < 6) {
      return reply.status(400).send({ error: 'La nueva contraseña debe tener al menos 6 caracteres' })
    }

    try {
      const usuario = await prisma.usuario.findUnique({ where: { id } })
      if (!usuario) return reply.status(404).send({ error: 'Usuario no encontrado' })

      // Si viene password_actual, validar (self-service)
      if (password_actual) {
        const ok = await bcrypt.compare(password_actual, usuario.password)
        if (!ok) return reply.status(400).send({ error: 'Contraseña actual incorrecta' })
      }

      const hash = await bcrypt.hash(password_nueva, 12)
      await prisma.usuario.update({ where: { id }, data: { password: hash } })
      return reply.send({ ok: true })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Error al cambiar contraseña' })
    }
  })

  // DELETE /usuarios/:id — desactivar (soft delete)
  fastify.delete('/:id', async (
    req: FastifyRequest<{ Params: UsuarioParams }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    try {
      const usuario = await prisma.usuario.findUnique({ where: { id } })
      if (!usuario) return reply.status(404).send({ error: 'Usuario no encontrado' })
      if (usuario.rol === 'OWNER') return reply.status(403).send({ error: 'No se puede desactivar al owner' })

      await prisma.usuario.update({ where: { id }, data: { activo: false } })
      return reply.send({ ok: true })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Error al desactivar usuario' })
    }
  })

  // ── Horarios del profesional ──────────────────────────────────────

  // GET /usuarios/:id/horarios
  fastify.get('/:id/horarios', async (
    req: FastifyRequest<{ Params: UsuarioParams }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const horarios = await prisma.horarioProfesional.findMany({
      where: { profesional_id: id },
      orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }],
    })
    return reply.send({ data: horarios })
  })

  // PUT /usuarios/:id/horarios
  // Reemplaza la lista completa de horarios del profesional.
  // Body: { horarios: Array<{ dia_semana: number, hora_inicio: string, hora_fin: string, activo?: boolean }> }
  fastify.put('/:id/horarios', async (
    req: FastifyRequest<{ Params: UsuarioParams; Body: { horarios: Array<{ dia_semana: number; hora_inicio: string; hora_fin: string; activo?: boolean }> } }>,
    reply: FastifyReply
  ) => {
    const { id } = req.params
    const { horarios } = req.body ?? { horarios: [] }

    const usuario = await prisma.usuario.findUnique({ where: { id } })
    if (!usuario) return reply.status(404).send({ error: 'Usuario no encontrado' })

    // Validacion basica
    const HM = /^([01]\d|2[0-3]):[0-5]\d$/
    for (const h of horarios) {
      if (h.dia_semana < 0 || h.dia_semana > 6) {
        return reply.status(400).send({ error: `dia_semana inválido: ${h.dia_semana}` })
      }
      if (!HM.test(h.hora_inicio) || !HM.test(h.hora_fin)) {
        return reply.status(400).send({ error: 'hora_inicio/hora_fin deben tener formato HH:mm' })
      }
      if (h.hora_inicio >= h.hora_fin) {
        return reply.status(400).send({ error: `Bloque inválido: ${h.hora_inicio} >= ${h.hora_fin}` })
      }
    }

    try {
      await prisma.$transaction([
        prisma.horarioProfesional.deleteMany({ where: { profesional_id: id } }),
        prisma.horarioProfesional.createMany({
          data: horarios.map(h => ({
            profesional_id: id,
            dia_semana: h.dia_semana,
            hora_inicio: h.hora_inicio,
            hora_fin: h.hora_fin,
            activo: h.activo ?? true,
          })),
        }),
      ])
      const nuevos = await prisma.horarioProfesional.findMany({
        where: { profesional_id: id },
        orderBy: [{ dia_semana: 'asc' }, { hora_inicio: 'asc' }],
      })
      return reply.send({ data: nuevos })
    } catch (error) {
      fastify.log.error(error)
      return reply.status(500).send({ error: 'Error al guardar horarios' })
    }
  })
}

function generarColor(): string {
  const colores = ['#C8A882', '#8BA888', '#D4957A', '#B89860', '#9B8BB4', '#7AA5B8', '#B88B8B', '#8BB4A5']
  return colores[Math.floor(Math.random() * colores.length)]
}

const selectUsuario = {
  id: true, nombre: true, apellido: true, email: true,
  rol: true, activo: true, color: true, telefono: true, createdAt: true,
  puede_ver_caja: true, puede_cobrar: true, puede_anular_ventas: true,
  puede_reimprimir_comprobantes: true, puede_ver_ventas_dia: true,
  puede_ver_reportes: true, puede_gestionar_turnos: true,
  puede_gestionar_clientes: true, puede_gestionar_servicios: true,
  puede_gestionar_productos: true, puede_gestionar_configuracion: true,
  puede_gestionar_usuarios: true, puede_gestionar_integraciones: true,
  _count: { select: { turnos: true } },
} as const

function permisosParaRol(rol: RolUsuario) {
  if (rol === 'ADMIN') {
    return {
      puede_ver_caja: true, puede_cobrar: true, puede_anular_ventas: true,
      puede_reimprimir_comprobantes: true, puede_ver_ventas_dia: true,
      puede_ver_reportes: true, puede_gestionar_turnos: true,
      puede_gestionar_clientes: true, puede_gestionar_servicios: true,
      puede_gestionar_productos: true, puede_gestionar_configuracion: true,
      puede_gestionar_usuarios: false, puede_gestionar_integraciones: true,
    }
  }
  // EMPLEADA: solo gestión de turnos por defecto
  return { puede_gestionar_turnos: true }
}
