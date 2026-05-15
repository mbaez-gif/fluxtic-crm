// api/src/routes/auth.ts
import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'

export async function authRoutes(app: FastifyInstance) {

  app.post('/auth/login', async (request, reply) => {
    const { email, password } = request.body as {
      email: string
      password: string
    }

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email y contraseña requeridos' })
    }

    const usuario = await app.prisma.usuario.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true, email: true, nombre: true, apellido: true, rol: true,
        activo: true, password: true,
        puede_ver_caja: true, puede_cobrar: true, puede_anular_ventas: true,
        puede_reimprimir_comprobantes: true, puede_ver_ventas_dia: true,
        puede_ver_reportes: true, puede_gestionar_turnos: true,
        puede_gestionar_clientes: true, puede_gestionar_servicios: true,
        puede_gestionar_productos: true, puede_gestionar_configuracion: true,
        puede_gestionar_usuarios: true, puede_gestionar_integraciones: true,
      },
    })

    if (!usuario || !usuario.activo) {
      return reply.status(401).send({ error: 'Credenciales inválidas' })
    }

    const passwordValida = await bcrypt.compare(password, usuario.password)

    if (!passwordValida) {
      return reply.status(401).send({ error: 'Credenciales inválidas' })
    }

    return reply.send({
      user: {
        id:       usuario.id,
        email:    usuario.email,
        nombre:   usuario.nombre,
        apellido: usuario.apellido,
        rol:      usuario.rol,
        permisos: {
          puede_ver_caja:                usuario.puede_ver_caja,
          puede_cobrar:                  usuario.puede_cobrar,
          puede_anular_ventas:           usuario.puede_anular_ventas,
          puede_reimprimir_comprobantes: usuario.puede_reimprimir_comprobantes,
          puede_ver_ventas_dia:          usuario.puede_ver_ventas_dia,
          puede_ver_reportes:            usuario.puede_ver_reportes,
          puede_gestionar_turnos:        usuario.puede_gestionar_turnos,
          puede_gestionar_clientes:      usuario.puede_gestionar_clientes,
          puede_gestionar_servicios:     usuario.puede_gestionar_servicios,
          puede_gestionar_productos:     usuario.puede_gestionar_productos,
          puede_gestionar_configuracion: usuario.puede_gestionar_configuracion,
          puede_gestionar_usuarios:      usuario.puede_gestionar_usuarios,
          puede_gestionar_integraciones: usuario.puede_gestionar_integraciones,
        },
      },
    })
  })
}
