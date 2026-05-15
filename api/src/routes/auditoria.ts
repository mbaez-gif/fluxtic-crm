import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export async function auditoriaRoutes(app: FastifyInstance) {
  app.get('/', async (req) => {
    req.requirePermiso('auditoria:ver')
    const q = (req.query as any) ?? {}
    const where: any = {}
    if (q.entidad) where.entidad = q.entidad
    if (q.entidad_id) where.entidad_id = q.entidad_id
    if (q.usuario_id) where.usuario_id = q.usuario_id
    if (q.accion) where.accion = q.accion
    if (q.desde || q.hasta) {
      where.created_at = {}
      if (q.desde) where.created_at.gte = new Date(q.desde)
      if (q.hasta) where.created_at.lte = new Date(q.hasta)
    }
    const take = Math.min(parseInt(q.limit ?? '100', 10), 500)
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { usuario: { select: { id: true, nombre: true, apellido: true, email: true, rol: true } } },
        orderBy: { created_at: 'desc' },
        take,
      }),
      prisma.auditLog.count({ where }),
    ])
    return { data, total }
  })

  app.get('/resumen', async (req) => {
    req.requirePermiso('auditoria:ver')
    const since = new Date(Date.now() - 24 * 3600 * 1000)
    const grouped = await prisma.auditLog.groupBy({
      by: ['accion', 'entidad'],
      where: { created_at: { gte: since } },
      _count: true,
      orderBy: { _count: { accion: 'desc' } },
    })
    return { ultimas_24h: grouped }
  })
}
