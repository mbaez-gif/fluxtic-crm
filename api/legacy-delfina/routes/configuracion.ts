import type { FastifyInstance } from 'fastify'
import { subirArchivoBase64 } from '../lib/storage'
import { dispararEventoN8n } from '../lib/n8n'
import { crearNotificacion } from '../lib/notificaciones'

export async function configuracionRoutes(app: FastifyInstance) {
  const prisma = app.prisma

  // ── Configuración del negocio ─────────────────────────────────────

  app.get('/negocio', async () => {
    const cfg = await prisma.configuracionNegocio.findFirst()
    if (!cfg) {
      return {
        nombre_comercial: 'Delfina Paz Beauty',
        cuit: null, direccion: null, telefono: null,
        email: null, instagram: null, logo_url: null,
        color_principal: '#A68660', texto_footer: null,
      }
    }
    return cfg
  })

  const CAMPOS_NEGOCIO = [
    'nombre_comercial', 'cuit', 'direccion', 'telefono', 'email',
    'instagram', 'logo_url', 'color_principal', 'texto_footer',
  ] as const

  app.put('/negocio', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>
      const data: Record<string, unknown> = {}
      for (const k of CAMPOS_NEGOCIO) {
        if (k in body) data[k] = body[k]
      }
      const existing = await prisma.configuracionNegocio.findFirst()
      if (existing) {
        const updated = await prisma.configuracionNegocio.update({
          where: { id: existing.id },
          data,
        })
        return reply.send(updated)
      }
      const created = await prisma.configuracionNegocio.create({ data: data as any })
      return reply.send(created)
    } catch (err) {
      request.log.error(err, '[PUT /configuracion/negocio]')
      const msg = err instanceof Error ? err.message : 'Error al guardar negocio'
      return reply.code(500).send({ error: msg })
    }
  })

  // ── Configuración de reservas y señas ─────────────────────────────

  app.get('/reservas', async () => {
    const cfg = await prisma.configuracionReservas.findFirst()
    if (!cfg) {
      return {
        sena_obligatoria: false, sena_tipo: 'SIN_SENA',
        sena_porcentaje: null, sena_monto_fijo: null,
        metodo_sena: 'SIN_SENA',
        vencimiento_minutos: 30,
        vencimiento_transf_horas: 24,
        mp_link_alternativo: null,
        alias_transferencia: null,
        titular_alias: null,
        mensaje_sena: null,
        mensaje_confirmacion: null, mensaje_recordatorio: null,
        tolerancia_validacion: 60,
        estado_inicial_mp: 'PENDIENTE_PAGO_MP',
        estado_inicial_transf: 'PENDIENTE_VALIDACION_MANUAL',
      }
    }
    return cfg
  })

  const CAMPOS_RESERVAS = [
    'sena_obligatoria', 'sena_tipo', 'sena_porcentaje', 'sena_monto_fijo',
    'metodo_sena', 'vencimiento_minutos', 'vencimiento_transf_horas',
    'mp_link_alternativo', 'alias_transferencia', 'titular_alias',
    'mensaje_sena', 'mensaje_confirmacion', 'mensaje_recordatorio',
    'tolerancia_validacion', 'estado_inicial_mp', 'estado_inicial_transf',
  ] as const

  app.put('/reservas', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>
      const data: Record<string, unknown> = {}
      for (const k of CAMPOS_RESERVAS) {
        if (k in body) data[k] = body[k]
      }
      const existing = await prisma.configuracionReservas.findFirst()
      if (existing) {
        const updated = await prisma.configuracionReservas.update({
          where: { id: existing.id },
          data,
        })
        return reply.send(updated)
      }
      const created = await prisma.configuracionReservas.create({ data: data as any })
      return reply.send(created)
    } catch (err) {
      request.log.error(err, '[PUT /configuracion/reservas]')
      const msg = err instanceof Error ? err.message : 'Error al guardar reservas'
      return reply.code(500).send({ error: msg })
    }
  })

  // ── Plantilla de comprobante ──────────────────────────────────────

  app.get('/plantilla-pdf', async () => {
    const cfg = await prisma.plantillaComprobante.findFirst()
    if (!cfg) {
      return {
        nombre_comercial: 'Delfina Paz Beauty',
        cuit: null, direccion: null, telefono: null, instagram: null, logo_url: null,
        color_principal: '#A68660', texto_footer: null,
        mostrar_logo: true, mostrar_cuit: false, mostrar_direccion: true,
        mostrar_telefono: true, mostrar_instagram: true, mostrar_qr: false,
        tipo_documento: 'COMPROBANTE',
      }
    }
    return cfg
  })

  const CAMPOS_PLANTILLA = [
    'nombre_comercial', 'cuit', 'direccion', 'telefono', 'instagram', 'logo_url',
    'color_principal', 'texto_footer', 'mostrar_logo', 'mostrar_cuit',
    'mostrar_direccion', 'mostrar_telefono', 'mostrar_instagram', 'mostrar_qr',
    'tipo_documento',
  ] as const

  app.put('/plantilla-pdf', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>
      const data: Record<string, unknown> = {}
      for (const k of CAMPOS_PLANTILLA) {
        if (k in body) data[k] = body[k]
      }
      const existing = await prisma.plantillaComprobante.findFirst()
      if (existing) {
        const updated = await prisma.plantillaComprobante.update({
          where: { id: existing.id },
          data,
        })
        return reply.send(updated)
      }
      const created = await prisma.plantillaComprobante.create({ data: data as any })
      return reply.send(created)
    } catch (err) {
      request.log.error(err, '[PUT /configuracion/plantilla-pdf]')
      const msg = err instanceof Error ? err.message : 'Error al guardar plantilla'
      return reply.code(500).send({ error: msg })
    }
  })

  // ── Comprobantes de transferencia ─────────────────────────────────

  const COMP_INCLUDE = {
    turno: {
      select: {
        id:           true,
        fecha:        true,
        sena:         true,
        cliente:      { select: { nombre: true, apellido: true, telefono: true } },
        servicio:     { select: { nombre: true } },
        profesional:  { select: { nombre: true, apellido: true } },
      }
    }
  } as const

  function mapComp(c: any) {
    const cliente = c.turno?.cliente
    const fecha: Date | null = c.turno?.fecha ? new Date(c.turno.fecha) : null
    const hora_inicio = fecha ? fecha.toTimeString().slice(0, 5) : null
    return {
      id:             c.id,
      turno_id:       c.turno_id,
      cliente_nombre: cliente ? `${cliente.nombre} ${cliente.apellido ?? ''}`.trim() : 'Sin cliente',
      telefono:       cliente?.telefono ?? null,
      servicio:       c.turno?.servicio?.nombre ?? null,
      profesional:    c.turno?.profesional
        ? `${c.turno.profesional.nombre} ${c.turno.profesional.apellido ?? ''}`.trim()
        : null,
      turno_fecha:    fecha ? fecha.toISOString().split('T')[0] : null,
      hora_inicio,
      monto:          c.monto_detectado ? Number(c.monto_detectado) : 0,
      fecha_subida:   c.createdAt,
      archivo_url:    c.archivo_url,
      estado:         c.estado,
      notas_admin:    c.motivo_revision ?? null,
      origen:         'ADMIN',
      validado_at:    c.validado_at ?? null,
    }
  }

  // GET /configuracion/comprobantes-pendientes
  app.get('/comprobantes-pendientes', async (request) => {
    const q = request.query as any
    const where = q.estado && q.estado !== 'todos'
      ? { estado: q.estado as any }
      : {}
    const comprobantes = await prisma.comprobanteManual.findMany({
      where,
      include: COMP_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })
    return { data: comprobantes.map(mapComp), total: comprobantes.length }
  })

  // POST /configuracion/comprobantes — carga manual desde admin o n8n
  app.post('/comprobantes', async (request, reply) => {
    const body = request.body as any
    const { turno_id, monto, archivo_url: urlDirecta, archivo_base64, archivo_nombre } = body
   
     if (!turno_id) return reply.status(400).send({ error: 'turno_id requerido' })

    const turnoExiste = await prisma.turno.findUnique({ where: { id: turno_id } })
    if (!turnoExiste) return reply.status(404).send({ error: 'Turno no encontrado' })

    let finalUrl = urlDirecta ?? ''

    if (archivo_base64 && archivo_nombre) {
      finalUrl = await subirArchivoBase64({
        base64: archivo_base64,
        nombre: archivo_nombre,
        carpeta: `comprobantes/${turno_id}`,
      })
    }

    const comp = await prisma.comprobanteManual.create({
      data: {
        turno_id,
        archivo_url: finalUrl,
        monto_detectado: monto ? Number(monto) : null,
        estado: 'PENDIENTE',
      },
      include: COMP_INCLUDE,
    })
    return reply.status(201).send(mapComp(comp))
  })

  // PATCH /configuracion/comprobantes-pendientes/:id/aprobar
  app.patch('/comprobantes-pendientes/:id/aprobar', async (request, reply) => {
    const { id } = request.params as any
    const comp = await prisma.comprobanteManual.findUnique({
      where: { id },
      include: {
        turno: {
          select: {
            id: true, estado: true, sena: true, grupo_reserva_id: true,
            cliente: { select: { nombre: true, apellido: true, telefono: true } },
            servicio: { select: { nombre: true } },
            profesional: { select: { nombre: true, apellido: true } },
            fecha: true,
          },
        },
      },
    })
    if (!comp) return reply.status(404).send({ error: 'Comprobante no encontrado' })

    const estadoPrevio = comp.turno?.estado ?? null

    await prisma.$transaction(async tx => {
      await tx.comprobanteManual.update({
        where: { id },
        data: { estado: 'APROBADO', validado_at: new Date() },
      })

      const senaUpdate = comp.monto_detectado && !comp.turno?.sena
        ? { sena: comp.monto_detectado }
        : {}

      // Confirmar el turno principal
      await tx.turno.update({
        where: { id: comp.turno_id },
        data: { estado: 'CONFIRMADO', reserva_expira_en: null, ...senaUpdate, updatedAt: new Date() },
      })

      // Si es parte de un grupo multi-servicio, confirmar todos los hermanos
      if (comp.turno?.grupo_reserva_id) {
        await tx.turno.updateMany({
          where: {
            grupo_reserva_id: comp.turno.grupo_reserva_id,
            id: { not: comp.turno_id },
            estado: { in: ['PENDIENTE_VALIDACION_MANUAL', 'PENDIENTE_PAGO_MP', 'PENDIENTE'] },
          },
          data: { estado: 'CONFIRMADO', reserva_expira_en: null, updatedAt: new Date() },
        })
      }

      await tx.eventoN8n.create({
        data: {
          workflow_name: 'comprobante_aprobado',
          estado: 'EXITOSO',
          mensaje: `Comprobante ${id} aprobado. Turno ${comp.turno_id} CONFIRMADO.${comp.turno?.grupo_reserva_id ? ` (grupo ${comp.turno.grupo_reserva_id})` : ''}`,
          referencia_id: comp.turno_id,
          payload: {
            comprobante_id: id,
            turno_id: comp.turno_id,
            grupo_reserva_id: comp.turno?.grupo_reserva_id ?? null,
            monto: comp.monto_detectado ? Number(comp.monto_detectado) : null,
          },
        },
      })
    })

    // Disparar WF6 solo si el turno venia esperando una transferencia.
    // Si venia de pago MP, ese flujo no necesita aviso extra (lo manda WF3).
    if (estadoPrevio === 'PENDIENTE_VALIDACION_MANUAL') {
      dispararEventoN8n('comprobante-aprobado', {
        turno_id: comp.turno_id,
        comprobante_id: id,
        monto_detectado: comp.monto_detectado ? Number(comp.monto_detectado) : null,
      }).catch(() => {})
    }

    crearNotificacion({
      tipo: 'COMPROBANTE_APROBADO',
      titulo: 'Comprobante aprobado',
      mensaje: `Aprobaste el comprobante del turno #${comp.turno_id.slice(-8).toUpperCase()}.`,
      referencia_id: id,
      url_destino: `/admin/turnos/tablero?turno=${comp.turno_id}`,
    }).catch(() => {})

    const updated = await prisma.comprobanteManual.findUnique({ where: { id }, include: COMP_INCLUDE })
    return reply.send(mapComp(updated))
  })

  // PATCH /configuracion/comprobantes-pendientes/:id/rechazar
  app.patch('/comprobantes-pendientes/:id/rechazar', async (request, reply) => {
    const { id } = request.params as any
    const { motivo } = request.body as any

    const comp = await prisma.comprobanteManual.findUnique({
      where: { id },
      select: {
        turno_id: true,
        turno: { select: { id: true, estado: true, grupo_reserva_id: true } },
      },
    })
    if (!comp) return reply.status(404).send({ error: 'Comprobante no encontrado' })

    await prisma.$transaction(async tx => {
      await tx.comprobanteManual.update({
        where: { id },
        data: { estado: 'RECHAZADO', motivo_revision: motivo ?? null },
      })

      // Rechazar el turno si aún está esperando validación
      if (comp.turno && ['PENDIENTE_VALIDACION_MANUAL', 'PENDIENTE_PAGO_MP', 'PENDIENTE'].includes(comp.turno.estado)) {
        await tx.turno.update({
          where: { id: comp.turno_id },
          data: { estado: 'RECHAZADO', reserva_expira_en: null, updatedAt: new Date() },
        })

        // Rechazar también los turnos hermanos del grupo
        if (comp.turno.grupo_reserva_id) {
          await tx.turno.updateMany({
            where: {
              grupo_reserva_id: comp.turno.grupo_reserva_id,
              id: { not: comp.turno_id },
              estado: { in: ['PENDIENTE_VALIDACION_MANUAL', 'PENDIENTE_PAGO_MP', 'PENDIENTE'] },
            },
            data: { estado: 'RECHAZADO', reserva_expira_en: null, updatedAt: new Date() },
          })
        }
      }

      await tx.eventoN8n.create({
        data: {
          workflow_name: 'comprobante_rechazado',
          estado: 'EXITOSO',
          mensaje: `Comprobante ${id} rechazado.${motivo ? ' Motivo: ' + motivo : ''}${comp.turno?.grupo_reserva_id ? ` (grupo ${comp.turno.grupo_reserva_id})` : ''}`,
          referencia_id: comp.turno_id,
          payload: {
            comprobante_id: id,
            turno_id: comp.turno_id,
            grupo_reserva_id: comp.turno?.grupo_reserva_id ?? null,
            motivo: motivo ?? null,
          },
        },
      })
    })

    const updated = await prisma.comprobanteManual.findUnique({ where: { id }, include: COMP_INCLUDE })
    return reply.send(mapComp(updated))
  })
}
