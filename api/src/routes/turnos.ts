import { FastifyInstance } from 'fastify'
import { vencerReservasExpiradas } from '../services/expiracion.service'
import { crearPreference } from '../services/mercadopago.service'
import { calcularSena } from '../services/sena.service'
import { generateExternalReference } from '../utils/external-reference'
import { dispararEventoN8n } from '../lib/n8n'
import { crearNotificacion } from '../lib/notificaciones'
import { handleError, errors } from '../utils/http-errors'

export async function turnosRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  const include = {
    cliente:     { select: { id: true, nombre: true, apellido: true, telefono: true } },
    servicio:    { select: { id: true, nombre: true, duracion_min: true, categoria: true } },
    profesional: { select: { id: true, nombre: true, apellido: true, color: true } },
  }

  // GET /turnos
  app.get('/', async (request) => {
    const { fecha, estado, profesional_id, limit } = request.query as any
    const where: any = {}

    if (fecha) {
      const inicio = new Date(fecha); inicio.setHours(0, 0, 0, 0)
      const fin    = new Date(fecha); fin.setHours(23, 59, 59, 999)
      where.fecha = { gte: inicio, lte: fin }
    }
    if (estado)         where.estado         = estado
    if (profesional_id) where.profesional_id = profesional_id

    const turnos = await prisma.turno.findMany({
      where,
      include,
      orderBy: { fecha: 'asc' },
      ...(limit && { take: parseInt(limit) }),
    })

    return { data: turnos.map(serializarTurno), total: turnos.length }
  })

  // GET /turnos/proximos-sin-recordatorio  ← usado por WF2 en n8n
  app.get('/proximos-sin-recordatorio', async () => {
    const ahora = new Date()
    const en24  = new Date(ahora.getTime() + 24 * 60 * 60 * 1000)

    const turnos = await prisma.turno.findMany({
      where: {
        fecha:               { gte: ahora, lte: en24 },
        estado:              { in: ['PENDIENTE', 'CONFIRMADO'] },
        recordatorio_enviado: false,
      },
      include,
    })

    // Formato plano que consume n8n directamente
    return {
      data: turnos.map(t => ({
        turno_id:         t.id,
        cliente_nombre:   t.cliente.nombre,
        cliente_telefono: t.cliente.telefono ?? '',
        servicio:         t.servicio.nombre,
        profesional:      t.profesional.nombre,
        fecha:            t.fecha.toISOString().split('T')[0],
        hora:             t.fecha.toTimeString().slice(0, 5),
      })),
    }
  })

  // GET /turnos/completados-sin-seguimiento  ← usado por WF3 en n8n
  app.get('/completados-sin-seguimiento', async () => {
    const hace2hs = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const hace8hs = new Date(Date.now() - 8 * 60 * 60 * 1000)

    const turnos = await prisma.turno.findMany({
      where: {
        estado:             'COMPLETADO',
        seguimiento_enviado: false,
        updatedAt:          { gte: hace8hs, lte: hace2hs },
      },
      include,
    })

    return {
      data: turnos.map(t => ({
        turno_id:         t.id,
        cliente_nombre:   t.cliente.nombre,
        cliente_telefono: t.cliente.telefono ?? '',
        servicio:         t.servicio.nombre,
      })),
    }
  })

  // POST /turnos/pre-reserva  ← usado por n8n/IA para crear turno + link de pago en un paso
  app.post('/pre-reserva', async (request, reply) => {
    try {
      const body = request.body as any
      const { cliente_id, servicio_id, profesional_id, fecha, hora_inicio, origen_reserva, notas } = body

      if (!cliente_id || !servicio_id || !profesional_id || !fecha || !hora_inicio) {
        throw errors.badRequest('Faltan campos requeridos: cliente_id, servicio_id, profesional_id, fecha, hora_inicio')
      }

      const [servicio, cliente] = await Promise.all([
        prisma.servicio.findUnique({ where: { id: servicio_id } }),
        prisma.cliente.findUnique({ where: { id: cliente_id }, select: { id: true, nombre: true, apellido: true, email: true, telefono: true } }),
      ])
      if (!servicio) throw errors.notFound('Servicio')
      if (!cliente)  throw errors.notFound('Cliente')

      const sena = calcularSena(servicio)

      const [hora, min] = hora_inicio.split(':').map(Number)
      const fechaDateTime = new Date(fecha)
      fechaDateTime.setHours(hora, min, 0, 0)

      // Crear turno primero para obtener el ID (necesario para external_reference)
      const turno = await prisma.turno.create({
        data: {
          cliente_id,
          servicio_id,
          profesional_id,
          fecha: fechaDateTime,
          duracion_min:   servicio.duracion_min,
          precio:         servicio.precio,
          monto_total:    servicio.precio,
          estado:         sena.requiere ? 'PENDIENTE_PAGO_MP' : 'PENDIENTE',
          sena_requerida: sena.requiere,
          monto_sena:     sena.requiere ? sena.monto : null,
          notas:          notas ?? null,
          origen_reserva: origen_reserva ?? 'WHATSAPP',
        },
        include,
      })

      // Si no requiere seña, devolver directamente
      if (!sena.requiere) {
        return reply.code(201).send({
          ok: true,
          turno: serializarTurno(turno),
          sena_requerida: false,
          init_point: null,
          monto_sena: 0,
          external_reference: null,
        })
      }

      const externalRef = generateExternalReference(turno.id)
      const expiracionMin = parseInt(process.env.RESERVA_EXPIRACION_MINUTOS || '15', 10)

      let preference: { preference_id: string; init_point: string }
      try {
        preference = await crearPreference({
          external_reference: externalRef,
          amount: sena.monto,
          description: `Seña - ${servicio.nombre}`,
          payer: {
            name:    cliente.nombre,
            surname: cliente.apellido || undefined,
            email:   cliente.email    || undefined,
            phone:   cliente.telefono || undefined,
          },
        })
      } catch (mpErr) {
        // Revertir turno creado si MP falla
        await prisma.turno.delete({ where: { id: turno.id } }).catch(() => {})
        throw mpErr
      }

      await prisma.$transaction(async tx => {
        await tx.pagoSena.create({
          data: {
            turno_id:           turno.id,
            external_reference: externalRef,
            preference_id:      preference.preference_id,
            init_point:         preference.init_point,
            amount:             sena.monto,
            currency:           'ARS',
            status:             'CREADO',
          },
        })

        await tx.turno.update({
          where: { id: turno.id },
          data: {
            reserva_expira_en:    new Date(Date.now() + expiracionMin * 60 * 1000),
            mp_preference_id:     preference.preference_id,
            mp_init_point:        preference.init_point,
            mp_external_reference: externalRef,
            updatedAt:            new Date(),
          },
        })

        await tx.eventoN8n.create({
          data: {
            workflow_name: 'pre_reserva_creada',
            estado:        'EXITOSO',
            mensaje:       `Pre-reserva creada para turno ${turno.id} vía ${origen_reserva ?? 'WHATSAPP'}`,
            referencia_id: turno.id,
            payload: {
              turno_id:           turno.id,
              external_reference: externalRef,
              preference_id:      preference.preference_id,
              init_point:         preference.init_point,
              monto_sena:         sena.monto,
            } as any,
          },
        })
      })

      return reply.code(201).send({
        ok: true,
        turno: serializarTurno({ ...turno, mp_init_point: preference.init_point }),
        sena_requerida: true,
        init_point:         preference.init_point,
        monto_sena:         sena.monto,
        external_reference: externalRef,
      })
    } catch (err) {
      handleError(err, reply)
    }
  })

  // GET /turnos/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as any
    const turno = await prisma.turno.findUnique({ where: { id }, include })
    if (!turno) return reply.notFound('Turno no encontrado')
    return { data: serializarTurno(turno) }
  })

  // POST /turnos
  app.post('/', async (request, reply) => {
    const body = request.body as any
    const { cliente_id, servicio_id, profesional_id, fecha, hora_inicio, senia, notas } = body
    if (!cliente_id || !servicio_id || !profesional_id || !fecha || !hora_inicio) {
      return reply.code(400).send({ error: 'Faltan campos requeridos' })
    }
    const servicio = await prisma.servicio.findUnique({ where: { id: servicio_id }, select: { duracion_min: true, precio: true } })
    if (!servicio) return reply.code(400).send({ error: 'Servicio no encontrado: ' + servicio_id })
    const [hora, min] = hora_inicio.split(':').map(Number)
    const fechaDateTime = new Date(fecha)
    fechaDateTime.setHours(hora, min, 0, 0)
    const turno = await prisma.turno.create({
      data: {
        cliente_id,
        servicio_id,
        profesional_id,
        fecha: fechaDateTime,
        duracion_min: servicio.duracion_min,
        precio: servicio.precio,
        monto_total: servicio.precio,
        sena: senia ?? null,
        notas: notas ?? null,
        estado: 'PENDIENTE',
      },
      include,
    })

    // Disparar evento a n8n (WF1) — fire and forget
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL
    if (n8nUrl) {
      fetch(`${n8nUrl}/webhook/turno-creado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          turno_id:         turno.id,
          cliente_nombre:   turno.cliente.nombre,
          cliente_telefono: turno.cliente.telefono,
          servicio:         turno.servicio.nombre,
          profesional:      turno.profesional.nombre,
          fecha:            turno.fecha.toISOString().split('T')[0],
          hora:             turno.fecha.toTimeString().slice(0, 5),
        }),
      }).catch(err => app.log.error({ err }, 'Error disparando webhook n8n'))
    }

    return reply.code(201).send({ data: serializarTurno(turno) })
  })

  // PATCH /turnos/:id  ← usado por n8n para actualizar estado
  app.patch('/:id', async (request) => {
    const { id } = request.params as any
    const body   = request.body as any

    const turno = await prisma.turno.update({
      where: { id },
      data:  { ...body, updatedAt: new Date() },
      include,
    })

    // Solo actualizar último turno y contador; total_compras lo maneja la venta
    if (body.estado === 'COMPLETADO') {
      await prisma.cliente.update({
        where: { id: turno.cliente_id },
        data: { ultimo_turno: new Date(), cant_turnos: { increment: 1 } },
      })
    }

    return { data: serializarTurno(turno) }
  })



  // POST /turnos/vencer-reservas
  // Llamado por n8n cron cada 1 minuto.
  app.post('/vencer-reservas', async (request, reply) => {
    try {
      const token = request.headers['x-internal-token']
      if (token !== process.env.INTERNAL_API_TOKEN) {
        throw errors.unauthorized('X-Internal-Token requerido')
      }

      const result = await vencerReservasExpiradas()
      return reply.send(result)
    } catch (err) {
      handleError(err, reply)
    }
  })

  // POST /turnos/:id/confirmar
  // Confirmación manual del admin.
  app.post('/:id/confirmar', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as any

      const turno = await prisma.turno.findUnique({ where: { id } })
      if (!turno) throw errors.notFound('Turno')

      if (turno.estado === 'CONFIRMADO') {
        return reply.send({ ok: true, mensaje: 'Turno ya estaba confirmado', turno })
      }

      if (['COMPLETADO', 'CANCELADO', 'NO_SHOW'].includes(turno.estado)) {
        throw errors.badRequest(`No se puede confirmar turno en estado ${turno.estado}`)
      }

      const turnoActualizado = await prisma.turno.update({
        where: { id },
        data: {
          estado: 'CONFIRMADO',
          reserva_expira_en: null,
          notas: body?.observaciones || body?.notas || turno.notas,
          updatedAt: new Date(),
        },
      })

      await prisma.eventoN8n.create({
        data: {
          workflow_name: 'turno_confirmado_manual',
          estado: 'EXITOSO',
          mensaje: `Turno ${id} confirmado manualmente por admin`,
          referencia_id: id,
          payload: { turno_id: id, motivo: body?.motivo } as any,
        },
      })

      dispararEventoN8n('turno-confirmado-manual', {
        turno_id: id,
        estado_previo: turno.estado,
        motivo: body?.motivo ?? null,
      }).catch(() => {})

      crearNotificacion({
        tipo: 'TURNO_CONFIRMADO',
        titulo: 'Turno confirmado',
        mensaje: `Confirmaste el turno #${id.slice(-8).toUpperCase()}.`,
        referencia_id: id,
        url_destino: `/admin/turnos/tablero?turno=${id}`,
      }).catch(() => {})

      return reply.send({ ok: true, turno: turnoActualizado })
    } catch (err) {
      handleError(err, reply)
    }
  })

  // POST /turnos/:id/cancelar
  // Cancelación manual. Si tenía seña aprobada, marca el pago como REEMBOLSADO.
  app.post('/:id/cancelar', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const body = request.body as any

      await prisma.$transaction(async tx => {
        const turno = await tx.turno.findUnique({
          where: { id },
          include: { pagos_sena: true },
        })
        if (!turno) throw errors.notFound('Turno')

        if (['CANCELADO', 'COMPLETADO', 'NO_SHOW'].includes(turno.estado)) {
          throw errors.badRequest(`Turno ya está en estado ${turno.estado}`)
        }

        const notaCancelacion = body?.motivo
          ? `${turno.notas || ''}\n[Cancelación] ${body.motivo}`.trim()
          : turno.notas

        await tx.turno.update({
          where: { id },
          data: {
            estado: 'CANCELADO',
            reserva_expira_en: null,
            notas: notaCancelacion,
            updatedAt: new Date(),
          },
        })

        const pagoAprobado = turno.pagos_sena.find(p => p.status === 'APROBADO')
        if (pagoAprobado) {
          await tx.pagoSena.update({
            where: { id: pagoAprobado.id },
            data: {
              status: 'REEMBOLSADO',
              status_detail: 'Turno cancelado por admin. Requiere reembolso manual en Mercado Pago.',
            },
          })
        }

        await tx.eventoN8n.create({
          data: {
            workflow_name: 'turno_cancelado',
            estado: 'EXITOSO',
            mensaje: `Turno ${id} cancelado${pagoAprobado ? ' — REQUIERE REEMBOLSO MANUAL' : ''}`,
            referencia_id: id,
            payload: {
              turno_id: id,
              tenia_pago_aprobado: !!pagoAprobado,
              monto_a_reembolsar: pagoAprobado ? Number(pagoAprobado.amount) : 0,
              motivo: body?.motivo,
            } as any,
          },
        })
      })

      crearNotificacion({
        tipo: 'TURNO_CANCELADO',
        titulo: 'Turno cancelado',
        mensaje: body?.motivo
          ? `Cancelaste el turno #${id.slice(-8).toUpperCase()}. Motivo: ${body.motivo}`
          : `Cancelaste el turno #${id.slice(-8).toUpperCase()}.`,
        referencia_id: id,
        url_destino: `/admin/turnos/tablero?turno=${id}`,
      }).catch(() => {})

      return reply.send({ ok: true })
    } catch (err) {
      handleError(err, reply)
    }
  })

  // POST /turnos/:id/generar-pago-sena
  // Genera link de pago MP para un turno existente.
  app.post('/:id/generar-pago-sena', async (request, reply) => {
    try {
      const { id } = request.params as { id: string }

      const turno = await prisma.turno.findUnique({
        where: { id },
        include: { servicio: true, cliente: true },
      })
      if (!turno) throw errors.notFound('Turno')

      const sena = calcularSena(turno.servicio)
      if (!sena.requiere) {
        throw errors.badRequest('El servicio no requiere seña')
      }

      const pagosActivos = await prisma.pagoSena.findMany({
        where: { turno_id: id, status: { in: ['CREADO', 'APROBADO'] } },
      })
      if (pagosActivos.length > 0) {
        throw errors.badRequest('El turno ya tiene un pago activo')
      }

      const externalRef = generateExternalReference(id)

      const preference = await crearPreference({
        external_reference: externalRef,
        amount: sena.monto,
        description: `Seña - ${turno.servicio.nombre}`,
        payer: {
          name: turno.cliente.nombre,
          surname: turno.cliente.apellido || undefined,
          email: turno.cliente.email || undefined,
          phone: turno.cliente.telefono || undefined,
        },
      })

      const expiracionMin = parseInt(process.env.RESERVA_EXPIRACION_MINUTOS || '15', 10)

      await prisma.$transaction(async tx => {
        await tx.pagoSena.create({
          data: {
            turno_id: id,
            external_reference: externalRef,
            preference_id: preference.preference_id,
            init_point: preference.init_point,
            amount: sena.monto,
            currency: 'ARS',
            status: 'CREADO',
          },
        })

        await tx.turno.update({
          where: { id },
          data: {
            estado: 'PENDIENTE_PAGO_MP',
            reserva_expira_en: new Date(Date.now() + expiracionMin * 60 * 1000),
            sena_requerida: true,
            monto_sena: sena.monto,
            mp_preference_id: preference.preference_id,
            mp_init_point: preference.init_point,
            mp_external_reference: externalRef,
            updatedAt: new Date(),
          },
        })

        await tx.eventoN8n.create({
          data: {
            workflow_name: 'turno_pago_sena_generado',
            estado: 'EXITOSO',
            mensaje: `Link de seña generado para turno ${id}`,
            referencia_id: id,
            payload: {
              turno_id: id,
              external_reference: externalRef,
              preference_id: preference.preference_id,
              init_point: preference.init_point,
              monto_sena: sena.monto,
            } as any,
          },
        })
      })

      return reply.send({
        ok: true,
        turno_id: id,
        external_reference: externalRef,
        preference_id: preference.preference_id,
        init_point: preference.init_point,
        monto_sena: sena.monto,
      })
    } catch (err) {
      handleError(err, reply)
    }
  })


function serializarTurno(t: any) {
  const fecha = t.fecha instanceof Date ? t.fecha : new Date(t.fecha)
  const fechaStr = fecha.toISOString().split('T')[0]
  const horaStr = fecha.toTimeString().slice(0, 5)
  const finMs = fecha.getTime() + (t.duracion_min ?? 0) * 60000
  const horaFin = new Date(finMs).toTimeString().slice(0, 5)
  return {
    id: t.id,
    fecha: fechaStr,
    hora_inicio: horaStr,
    hora_fin: horaFin,
    duracion_min: t.duracion_min,
    estado: t.estado,
    precio: Number(t.precio),
    senia: t.sena !== null && t.sena !== undefined ? Number(t.sena) : null,
    notas: t.notas ?? null,
    cliente: t.cliente ? { id: t.cliente.id, nombre: t.cliente.nombre, apellido: t.cliente.apellido, telefono: t.cliente.telefono ?? '', segmento: t.cliente.segmento } : null,
    servicio: t.servicio ? { id: t.servicio.id, nombre: t.servicio.nombre, categoria: t.servicio.categoria, duracion_min: t.servicio.duracion_min, precio: Number(t.servicio.precio) } : null,
    profesional: t.profesional ? { id: t.profesional.id, nombre: t.profesional.nombre, apellido: t.profesional.apellido, color: t.profesional.color ?? '#C8A882' } : null,
    canal: t.origen_reserva ?? 'ADMIN',
    sena_pagada: t.sena !== null && t.sena !== undefined && Number(t.sena) > 0,
    automatizaciones: { confirmacion_enviada: t.confirmacion_enviada ?? false, recordatorio_enviado: t.recordatorio_enviado ?? false, recordatorio_respondido: false, seguimiento_enviado: t.seguimiento_enviado ?? false },
  }
}

}