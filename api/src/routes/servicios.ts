import { FastifyInstance } from 'fastify'
import { CategoriaServicio } from '@prisma/client'
import { validarConfigSena } from '../services/sena.service'
import { errors } from '../utils/http-errors'

export async function serviciosRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  // GET /servicios
  app.get('/', async () => {
    const servicios = await prisma.servicio.findMany({
      orderBy: { nombre: 'asc' },
      select: {
        id: true, nombre: true, categoria: true,
        duracion_min: true, precio: true, descripcion: true,
        foto_url: true, activo: true, createdAt: true,
        sena_tipo: true, sena_porcentaje: true, sena_monto_fijo: true, buffer_min: true,
        _count: { select: { turnos: true } }
      }
    })
    return { data: servicios.map(s => ({ ...s, precio: Number(s.precio) })), total: servicios.length }
  })

  // GET /servicios/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const s = await prisma.servicio.findUnique({
      where: { id },
      include: {
        insumos: {
          include: {
            producto: { select: { id: true, nombre: true, sku: true, stock_actual: true } }
          }
        },
        _count: { select: { turnos: true } }
      }
    })
    if (!s) return reply.code(404).send({ error: 'Servicio no encontrado' })
    return { data: { ...s, precio: Number(s.precio) } }
  })

  // POST /servicios
  app.post('/', async (request, reply) => {
    const body = request.body as any
    if (!body.nombre || !body.categoria || !body.duracion_min || body.precio === undefined) {
      return reply.code(400).send({ error: 'Faltan campos obligatorios' })
    }
    const senaError = validarConfigSena({
      sena_tipo: body.sena_tipo || 'SIN_SENA',
      sena_porcentaje: body.sena_porcentaje,
      sena_monto_fijo: body.sena_monto_fijo,
    })
    if (senaError) {
      throw errors.badRequest(senaError, 'CONFIG_SENA_INVALIDA')
    }

    const bufferMin = body.buffer_min !== undefined ? Number(body.buffer_min) : 5
    if (bufferMin < 0 || bufferMin > 120) {
      throw errors.badRequest('buffer_min debe estar entre 0 y 120 minutos')
    }

    const s = await prisma.servicio.create({
      data: {
        nombre: body.nombre,
        descripcion: body.descripcion ?? null,
        categoria: body.categoria as CategoriaServicio,
        duracion_min: Number(body.duracion_min),
        precio: Number(body.precio),
        foto_url: body.foto_url ?? null,
        activo: body.activo ?? true,
        sena_tipo: body.sena_tipo || 'SIN_SENA',
        sena_porcentaje: body.sena_porcentaje ?? null,
        sena_monto_fijo: body.sena_monto_fijo ?? null,
        buffer_min: bufferMin,
      },
      select: {
        id: true, nombre: true, categoria: true,
        duracion_min: true, precio: true, descripcion: true,
        foto_url: true, activo: true, createdAt: true,
        sena_tipo: true, sena_porcentaje: true, sena_monto_fijo: true, buffer_min: true,
        _count: { select: { turnos: true } }
      }
    })
    return reply.code(201).send({ ...s, precio: Number(s.precio) })
  })

  // PATCH /servicios/:id
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as any
    const existe = await prisma.servicio.findUnique({ where: { id } })
    if (!existe) return reply.code(404).send({ error: 'Servicio no encontrado' })
    if (body.sena_tipo !== undefined) {
      const senaError = validarConfigSena({
        sena_tipo: body.sena_tipo,
        sena_porcentaje: body.sena_porcentaje,
        sena_monto_fijo: body.sena_monto_fijo,
      })
      if (senaError) {
        throw errors.badRequest(senaError, 'CONFIG_SENA_INVALIDA')
      }
    }

    const updateData: any = {
      ...(body.nombre !== undefined && { nombre: body.nombre }),
      ...(body.descripcion !== undefined && { descripcion: body.descripcion }),
      ...(body.categoria !== undefined && { categoria: body.categoria as CategoriaServicio }),
      ...(body.duracion_min !== undefined && { duracion_min: Number(body.duracion_min) }),
      ...(body.precio !== undefined && { precio: Number(body.precio) }),
      ...(body.foto_url !== undefined && { foto_url: body.foto_url }),
      ...(body.activo !== undefined && { activo: body.activo }),
    }

    if (body.sena_tipo !== undefined) updateData.sena_tipo = body.sena_tipo
    if (body.sena_porcentaje !== undefined) updateData.sena_porcentaje = body.sena_porcentaje
    if (body.sena_monto_fijo !== undefined) updateData.sena_monto_fijo = body.sena_monto_fijo
    if (body.buffer_min !== undefined) {
      const bufferMinPatch = Number(body.buffer_min)
      if (bufferMinPatch < 0 || bufferMinPatch > 120) {
        throw errors.badRequest('buffer_min debe estar entre 0 y 120')
      }
      updateData.buffer_min = bufferMinPatch
    }

    const s = await prisma.servicio.update({
      where: { id },
      data: updateData,
      select: {
        id: true, nombre: true, categoria: true,
        duracion_min: true, precio: true, descripcion: true,
        foto_url: true, activo: true, createdAt: true,
        sena_tipo: true, sena_porcentaje: true, sena_monto_fijo: true, buffer_min: true,
        _count: { select: { turnos: true } }
      }
    })
    return { ...s, precio: Number(s.precio) }
  })

  // DELETE /servicios/:id — soft delete
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existe = await prisma.servicio.findUnique({ where: { id } })
    if (!existe) return reply.code(404).send({ error: 'Servicio no encontrado' })
    await prisma.servicio.update({ where: { id }, data: { activo: false } })
    return { ok: true }
  })
}
