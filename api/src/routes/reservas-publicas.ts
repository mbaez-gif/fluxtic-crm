/**
 * Routes: /reservas-publicas
 *
 * Endpoints para crear reservas desde el link público o desde n8n.
 * No requieren auth de admin. Se aceptan dos modos:
 *
 * 1. Sin auth (link público) — la clienta llena el formulario en la web.
 * 2. Con header X-Internal-Token (n8n) — workflows automatizados.
 *
 * En ambos casos pasa por el mismo motor (reservas.service.ts).
 */

import type { FastifyInstance } from 'fastify'
import { crearReserva } from '../services/reservas.service'
import { crearPreference } from '../services/mercadopago.service'
import { generateExternalReference } from '../utils/external-reference'
import { prisma } from '../lib/prisma'
import { subirArchivoBase64 } from '../lib/storage'
import { dispararEventoN8n } from '../lib/n8n'
import { crearNotificacion } from '../lib/notificaciones'
import { validarTurnstile } from '../lib/turnstile'
import { handleError, errors } from '../utils/http-errors'
import type { OrigenReserva } from '@prisma/client'

const ORIGENES_VALIDOS: OrigenReserva[] = ['LINK_PUBLICO', 'WHATSAPP', 'INSTAGRAM', 'TIENDANUBE']

export async function reservasPublicasRoutes(fastify: FastifyInstance) {
  /**
   * POST /reservas-publicas
   *
   * Body:
   *   {
   *     servicio_id: string,
   *     profesional_id: string,
   *     fecha_inicio: string (ISO 8601),
   *     cliente: {
   *       nombre: string,
   *       apellido: string,
   *       telefono: string,
   *       email: string,
   *       notas?: string
   *     },
   *     origen?: 'LINK_PUBLICO' | 'WHATSAPP' | 'INSTAGRAM' | 'TIENDANUBE',
   *     notas_turno?: string
   *   }
   *
   * Headers (opcional, para n8n):
   *   X-Internal-Token: ${INTERNAL_API_TOKEN}
   *
   * Response:
   *   {
   *     turno: { ... },
   *     cliente_id: string,
   *     cliente_es_nuevo: boolean,
   *     requiere_pago: boolean,
   *     monto_sena: number,
   *     init_point: string | null,
   *     external_reference: string | null,
   *     reserva_expira_en: string | null
   *   }
   */
  fastify.post('/', async (request, reply) => {
    try {
      const body = request.body as any

      // Validación básica de body
      if (!body || typeof body !== 'object') {
        throw errors.badRequest('Body requerido')
      }
      if (!body.servicio_id) throw errors.badRequest('servicio_id es requerido')
      if (!body.profesional_id) throw errors.badRequest('profesional_id es requerido')
      if (!body.fecha_inicio) throw errors.badRequest('fecha_inicio es requerida')
      if (!body.cliente || typeof body.cliente !== 'object') {
        throw errors.badRequest('cliente es requerido')
      }
      if (!body.cliente.nombre) throw errors.badRequest('cliente.nombre es requerido')
      if (!body.cliente.telefono) throw errors.badRequest('cliente.telefono es requerido')

      // DNI obligatorio para reservas publicas (LINK_PUBLICO).
      // n8n con X-Internal-Token puede saltearlo.
      const esPublico = (body.origen ?? 'LINK_PUBLICO') === 'LINK_PUBLICO'
      const tokenInterno = request.headers['x-internal-token']
      const llamadaInterna = tokenInterno === process.env.INTERNAL_API_TOKEN
      if (esPublico && !llamadaInterna) {
        if (!body.cliente.dni) throw errors.badRequest('cliente.dni es requerido', 'DNI_REQUERIDO')
        const dniDigitos = String(body.cliente.dni).replace(/\D/g, '')
        if (dniDigitos.length < 6 || dniDigitos.length > 12) {
          throw errors.badRequest('El DNI debe tener entre 6 y 12 dígitos', 'DNI_INVALIDO')
        }

        // Validar token de Turnstile (si esta configurado en .env)
        const remoteIp = (request.headers['cf-connecting-ip'] as string | undefined)
          ?? (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
          ?? request.ip
        await validarTurnstile(body.turnstile_token, remoteIp)
      }

      const fechaInicio = new Date(body.fecha_inicio)
      if (isNaN(fechaInicio.getTime())) {
        throw errors.badRequest('fecha_inicio inválida (debe ser ISO 8601)')
      }

      // Origen: si viene en body, validamos. Default LINK_PUBLICO.
      let origen: OrigenReserva = 'LINK_PUBLICO'
      if (body.origen) {
        if (!ORIGENES_VALIDOS.includes(body.origen)) {
          throw errors.badRequest(`origen inválido. Valores: ${ORIGENES_VALIDOS.join(', ')}`)
        }
        origen = body.origen
      }

      // Si origen != LINK_PUBLICO, requiere auth de n8n
      if (origen !== 'LINK_PUBLICO') {
        const token = request.headers['x-internal-token']
        if (token !== process.env.INTERNAL_API_TOKEN) {
          throw errors.unauthorized('X-Internal-Token requerido para origen no LINK_PUBLICO')
        }
      }

      // Validar metodo_pago_elegido si viene
      let metodoElegido: 'MERCADOPAGO' | 'TRANSFERENCIA' | undefined
      if (body.metodo_pago_elegido) {
        if (body.metodo_pago_elegido !== 'MERCADOPAGO' && body.metodo_pago_elegido !== 'TRANSFERENCIA') {
          throw errors.badRequest('metodo_pago_elegido debe ser MERCADOPAGO o TRANSFERENCIA')
        }
        metodoElegido = body.metodo_pago_elegido
      }

      const result = await crearReserva({
        servicio_id: body.servicio_id,
        profesional_id: body.profesional_id,
        fecha_inicio: fechaInicio,
        cliente: {
          nombre: body.cliente.nombre,
          apellido: body.cliente.apellido,
          dni: body.cliente.dni,
          telefono: body.cliente.telefono,
          email: body.cliente.email,
          notas: body.cliente.notas,
        },
        origen,
        notas_turno: body.notas_turno,
        metodo_pago_elegido: metodoElegido,
        omitir_sena: body.omitir_sena === true,
        coordinar_por_whatsapp: body.coordinar_por_whatsapp === true,
      })

      // Disparar webhook a n8n: turno-creado
      // Lo hacemos best-effort (no bloquear la respuesta si falla)
      dispararEventoN8n('turno-creado', {
        turno_id: result.turno.id,
        cliente_id: result.cliente_id,
        cliente_es_nuevo: result.cliente_es_nuevo,
        requiere_pago: result.requiere_pago,
        metodo_pago: result.metodo_pago,
        monto_sena: result.monto_sena,
        init_point: result.init_point,
        external_reference: result.external_reference,
        alias_transferencia: result.alias_transferencia,
        reserva_expira_en: result.reserva_expira_en?.toISOString() || null,
        origen,
      }).catch(err => {
        console.error('[reservas-publicas] Error disparando webhook n8n:', err?.message)
      })

      // Notificacion al admin: hay una reserva nueva por chequear
      crearNotificacion({
        tipo: 'TURNO_NUEVO',
        titulo: 'Reserva nueva desde el link público',
        mensaje: `${body.cliente.nombre}${body.cliente.apellido ? ' ' + body.cliente.apellido : ''} reservó. Código #${result.turno.id.slice(-8).toUpperCase()}`,
        referencia_id: result.turno.id,
        url_destino: `/admin/turnos/tablero?turno=${result.turno.id}`,
      }).catch(() => {})

      return reply.code(201).send({
        turno: result.turno,
        cliente_id: result.cliente_id,
        cliente_es_nuevo: result.cliente_es_nuevo,
        cliente_conflicto_datos: result.cliente_conflicto_datos,
        cliente_detalle_conflicto: result.cliente_detalle_conflicto,
        requiere_pago: result.requiere_pago,
        metodo_pago: result.metodo_pago,
        monto_sena: result.monto_sena,
        init_point: result.init_point,
        external_reference: result.external_reference,
        alias_transferencia: result.alias_transferencia,
        titular_alias: result.titular_alias,
        mensaje_sena: result.mensaje_sena,
        reserva_expira_en: result.reserva_expira_en?.toISOString() || null,
      })
    } catch (err) {
      handleError(err, reply)
    }
  })

  /**
   * GET /reservas-publicas/:external_reference/estado
   *
   * Para que la página de pago haga polling y sepa cuando MP confirmó.
   * No requiere auth (cualquiera con el external_reference puede consultar).
   */
  fastify.get('/:external_reference/estado', async (request, reply) => {
    try {
      const { external_reference } = request.params as { external_reference: string }

      const pagoSena = await prisma.pagoSena.findUnique({
        where: { external_reference },
        include: {
          turno: {
            select: {
              id: true,
              estado: true,
              fecha: true,
              reserva_expira_en: true,
              servicio: { select: { nombre: true } },
              profesional: { select: { nombre: true, apellido: true } },
            },
          },
        },
      })

      if (!pagoSena) {
        throw errors.notFound('Reserva')
      }

      return reply.send({
        external_reference,
        pago_status: pagoSena.status,
        turno: {
          id: pagoSena.turno.id,
          estado: pagoSena.turno.estado,
          fecha: pagoSena.turno.fecha,
          reserva_expira_en: pagoSena.turno.reserva_expira_en,
          servicio_nombre: pagoSena.turno.servicio.nombre,
          profesional_nombre: `${pagoSena.turno.profesional.nombre}${
            pagoSena.turno.profesional.apellido ? ' ' + pagoSena.turno.profesional.apellido : ''
          }`,
        },
        amount: Number(pagoSena.amount),
        init_point: pagoSena.init_point,
      })
    } catch (err) {
      handleError(err, reply)
    }
  })

  /**
   * GET /reservas-publicas/config-sena
   *
   * Devuelve la configuración de seña que el frontend público necesita
   * para mostrar las opciones de pago. NO incluye campos sensibles.
   *
   * Response:
   *   {
   *     metodo_sena: 'MERCADOPAGO' | 'TRANSFERENCIA' | 'AMBOS' | 'SIN_SENA',
   *     alias_transferencia: string | null,
   *     titular_alias: string | null,
   *     mensaje_sena: string | null,
   *     vencimiento_transf_horas: number,
   *     vencimiento_mp_minutos: number
   *   }
   */
  fastify.get('/config-sena', async (_request, reply) => {
    try {
      const [cfg, negocio] = await Promise.all([
        prisma.configuracionReservas.findFirst(),
        prisma.configuracionNegocio.findFirst(),
      ])
      return reply.send({
        metodo_sena:              cfg?.metodo_sena ?? 'MERCADOPAGO',
        alias_transferencia:      cfg?.alias_transferencia ?? null,
        titular_alias:            cfg?.titular_alias ?? null,
        mensaje_sena:             cfg?.mensaje_sena ?? null,
        vencimiento_transf_horas: cfg?.vencimiento_transf_horas ?? 24,
        vencimiento_mp_minutos:   cfg?.vencimiento_minutos ?? 30,
        whatsapp_negocio:         normalizarTelefonoWa(negocio?.telefono ?? null),
        nombre_negocio:           negocio?.nombre_comercial ?? 'Delfina Paz',
      })
    } catch (err) {
      handleError(err, reply)
    }
  })

  /**
   * POST /reservas-publicas/:turno_id/comprobante
   *
   * Subir el comprobante de transferencia desde el flujo público.
   * Solo acepta turnos en PENDIENTE_VALIDACION_MANUAL y que no hayan vencido.
   *
   * Body:
   *   - monto: number (opcional)
   *   - archivo_base64: string (data URI o base64 pelado)
   *   - archivo_nombre: string (ej. "comprobante.jpg")
   *
   * Devuelve { ok: true, comprobante_id }.
   */
  fastify.post('/:turno_id/comprobante', async (request, reply) => {
    try {
      const { turno_id } = request.params as { turno_id: string }
      const body = request.body as any

      const turno = await prisma.turno.findUnique({ where: { id: turno_id } })
      if (!turno) throw errors.notFound('Turno')

      if (turno.estado !== 'PENDIENTE_VALIDACION_MANUAL') {
        throw errors.badRequest('Este turno no admite subida de comprobante', 'ESTADO_INVALIDO')
      }
      if (turno.reserva_expira_en && turno.reserva_expira_en.getTime() < Date.now()) {
        throw errors.badRequest('La reserva ya vencio', 'RESERVA_VENCIDA')
      }

      if (!body.archivo_base64 || !body.archivo_nombre) {
        throw errors.badRequest('archivo_base64 y archivo_nombre son requeridos')
      }

      const archivo_url = await subirArchivoBase64({
        base64: body.archivo_base64,
        nombre: body.archivo_nombre,
        carpeta: `comprobantes/${turno_id}`,
      })

      const comp = await prisma.comprobanteManual.create({
        data: {
          turno_id,
          archivo_url,
          monto_detectado: body.monto != null ? Number(body.monto) : null,
          estado: 'PENDIENTE',
        },
      })

      crearNotificacion({
        tipo: 'COMPROBANTE_PENDIENTE',
        titulo: 'Comprobante de transferencia para validar',
        mensaje: `Se subió un comprobante para el turno #${turno_id.slice(-8).toUpperCase()}. Validalo en "Señas recibidas".`,
        referencia_id: comp.id,
        url_destino: `/admin/configuracion/comprobantes?id=${comp.id}`,
      }).catch(() => {})

      return reply.code(201).send({ ok: true, comprobante_id: comp.id })
    } catch (err) {
      handleError(err, reply)
    }
  })

  /**
   * GET /reservas-publicas/codigo/:codigo
   *
   * Pensado para n8n: la clienta manda WhatsApp con #ABCD1234 y n8n llama
   * este endpoint para resolver el turno y obtener los medios de pago.
   *
   * - codigo: los ultimos 8 caracteres del turno_id (case-insensitive).
   * - Si la configuracion del negocio incluye MP, esta llamada GENERA
   *   (o reusa) una preference de Checkout para este turno especifico.
   * - Si incluye TRANSFERENCIA, devuelve el alias y titular.
   * - Devuelve 404 si no hay turno, 409 si el codigo es ambiguo.
   */
  fastify.get('/codigo/:codigo', async (request, reply) => {
    try {
      const { codigo } = request.params as { codigo: string }
      if (!codigo || codigo.length < 6) {
        throw errors.badRequest('Codigo demasiado corto')
      }
      const codigoLower = codigo.toLowerCase().replace(/[^a-z0-9]/g, '')

      // Buscar por sufijo del id (cuid)
      const candidatos = await prisma.turno.findMany({
        where: { id: { endsWith: codigoLower } },
        include: {
          cliente:     { select: { nombre: true, apellido: true, telefono: true } },
          servicio:    { select: { id: true, nombre: true, precio: true, duracion_min: true } },
          profesional: { select: { nombre: true, apellido: true } },
          pagos_sena:  { where: { status: { in: ['CREADO', 'PENDIENTE', 'APROBADO'] } }, take: 1 },
        },
        take: 5,
      })

      if (candidatos.length === 0) throw errors.notFound('Reserva')
      if (candidatos.length > 1) {
        return reply.code(409).send({
          error: 'Codigo ambiguo, pediles el codigo completo',
          coincidencias: candidatos.length,
        })
      }

      const turno = candidatos[0]
      const cfgReservas = await prisma.configuracionReservas.findFirst()
      const metodoConfig = cfgReservas?.metodo_sena ?? 'SIN_SENA'

      // Monto sena: el guardado si existe, si no lo calculo del servicio.
      const montoSena = turno.monto_sena ? Number(turno.monto_sena) : 0

      const respuesta: Record<string, unknown> = {
        turno: {
          id: turno.id,
          codigo: turno.id.slice(-8).toUpperCase(),
          fecha: turno.fecha,
          estado: turno.estado,
          duracion_min: turno.duracion_min,
        },
        cliente: {
          nombre: `${turno.cliente.nombre}${turno.cliente.apellido ? ' ' + turno.cliente.apellido : ''}`,
          telefono: turno.cliente.telefono,
        },
        servicio: {
          nombre: turno.servicio.nombre,
          precio: Number(turno.servicio.precio),
          duracion_min: turno.servicio.duracion_min,
        },
        profesional: `${turno.profesional.nombre}${turno.profesional.apellido ? ' ' + turno.profesional.apellido : ''}`,
        monto_total: Number(turno.monto_total),
        monto_sena: montoSena,
        metodo_sena_config: metodoConfig,
        mercadopago: null,
        transferencia: null,
      }

      // Si la config admite MP y el turno todavia no tiene preference, generarla.
      const ofreceMP = metodoConfig === 'MERCADOPAGO' || metodoConfig === 'AMBOS'
      if (ofreceMP && montoSena > 0) {
        let pagoSena = turno.pagos_sena[0]
        if (!pagoSena) {
          // Generar preference y persistirla
          const externalRef = generateExternalReference(turno.id)
          const preference = await crearPreference({
            external_reference: externalRef,
            amount: montoSena,
            description: `Sena - ${turno.servicio.nombre}`,
            payer: {
              name: turno.cliente.nombre,
              surname: turno.cliente.apellido || undefined,
              phone: turno.cliente.telefono || undefined,
            },
          })
          const nuevo = await prisma.pagoSena.create({
            data: {
              turno_id: turno.id,
              external_reference: externalRef,
              preference_id: preference.preference_id,
              init_point: preference.init_point,
              amount: montoSena,
              currency: 'ARS',
              status: 'CREADO',
            },
          })
          await prisma.turno.update({
            where: { id: turno.id },
            data: {
              mp_preference_id: preference.preference_id,
              mp_init_point: preference.init_point,
              mp_external_reference: externalRef,
            },
          })
          pagoSena = nuevo as any
        }
        respuesta.mercadopago = {
          init_point: pagoSena.init_point,
          external_reference: pagoSena.external_reference,
          monto: Number(pagoSena.amount),
        }
      }

      // Si la config admite transferencia, devolver alias/titular.
      const ofreceTransf = metodoConfig === 'TRANSFERENCIA' || metodoConfig === 'AMBOS'
      if (ofreceTransf) {
        respuesta.transferencia = {
          alias: cfgReservas?.alias_transferencia ?? null,
          titular: cfgReservas?.titular_alias ?? null,
          monto: montoSena,
        }
      }

      return reply.send(respuesta)
    } catch (err) {
      handleError(err, reply)
    }
  })
}

/**
 * Normaliza un telefono para usarlo en links de wa.me.
 * Quita todo lo que no sea digito. Si no empieza con 54 (Argentina),
 * asume nacional y agrega el codigo de pais. Devuelve null si no hay tel.
 *
 * Devuelve solo digitos (sin +), que es lo que wa.me espera.
 */
function normalizarTelefonoWa(telefono: string | null): string | null {
  if (!telefono) return null
  let digitos = telefono.replace(/\D/g, '')
  if (!digitos) return null
  if (digitos.startsWith('0')) digitos = digitos.substring(1)
  if (!digitos.startsWith('54')) digitos = '54' + digitos
  if (!digitos.startsWith('549') && digitos.startsWith('54')) {
    digitos = '549' + digitos.substring(2)
  }
  return digitos
}
