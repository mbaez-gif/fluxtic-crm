/**
 * Endpoints del portal del paciente. Todos los handlers verifican que el
 * usuario autenticado tenga rol PACIENTE y filtran por su paciente_id.
 */
import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { writeAudit, auditMetaFromRequest } from '../lib/audit'

function requirePaciente(req: any) {
  const user = req.requireAuth()
  if (user.rol !== 'PACIENTE' || !user.paciente_id) {
    const e: any = new Error('Solo accesible para pacientes')
    e.statusCode = 403
    throw e
  }
  return { user, paciente_id: user.paciente_id }
}

export async function portalRoutes(app: FastifyInstance) {
  app.get('/mi-perfil', async (req) => {
    const { paciente_id } = requirePaciente(req)
    return prisma.paciente.findUnique({
      where: { id: paciente_id },
      include: {
        contactos: true,
        coberturas: { include: { cobertura: true, plan: true } },
      },
    })
  })

  app.get('/mis-turnos', async (req) => {
    const { paciente_id } = requirePaciente(req)
    return prisma.turno.findMany({
      where: { paciente_id, estado: { not: 'CANCELADO' } },
      include: {
        profesional: { include: { usuario: { select: { nombre: true, apellido: true } }, especialidad: true } },
        prestacion: { select: { nombre: true } },
        sede: { select: { nombre: true, direccion: true } },
        consultorio: { select: { nombre: true, numero: true } },
      },
      orderBy: { fecha_hora: 'desc' },
      take: 50,
    })
  })

  app.get('/mi-historia', async (req) => {
    const { user, paciente_id } = requirePaciente(req)
    const hc = await prisma.historiaClinica.findUnique({ where: { paciente_id } })
    if (!hc) return { evoluciones: [], indicaciones: [] }
    const [evoluciones, indicaciones] = await Promise.all([
      // Solo evoluciones firmadas son visibles al paciente
      prisma.evolucionClinica.findMany({
        where: { historia_id: hc.id, firmado_at: { not: null } },
        select: {
          id: true,
          fecha: true,
          motivo_consulta: true,
          plan: true,
          profesional: { select: { usuario: { select: { nombre: true, apellido: true } }, especialidad: true } },
        },
        orderBy: { fecha: 'desc' },
      }),
      prisma.indicacion.findMany({
        where: { historia_id: hc.id, visible_paciente: true },
        orderBy: { fecha: 'desc' },
      }),
    ])
    await writeAudit({
      usuario_id: user.id,
      accion: 'VER',
      entidad: 'PortalHistoriaClinica',
      entidad_id: hc.id,
      contexto: { paciente_id },
      ...auditMetaFromRequest(req),
    })
    return { evoluciones, indicaciones }
  })

  app.get('/mis-documentos', async (req) => {
    const { paciente_id } = requirePaciente(req)
    return prisma.documentoClinico.findMany({
      where: { paciente_id, visible_paciente: true },
      orderBy: { created_at: 'desc' },
    })
  })

  app.get('/mis-pagos', async (req) => {
    const { paciente_id } = requirePaciente(req)
    const [pagos, comprobantes_pendientes] = await Promise.all([
      prisma.pago.findMany({
        where: { paciente_id },
        include: { comprobante: { select: { id: true, numero: true, total: true } } },
        orderBy: { fecha: 'desc' },
        take: 50,
      }),
      prisma.comprobante.findMany({
        where: { paciente_id, estado: { in: ['EMITIDO', 'PAGO_PARCIAL'] } },
        orderBy: { fecha: 'desc' },
      }),
    ])
    return { pagos, comprobantes_pendientes }
  })
}
