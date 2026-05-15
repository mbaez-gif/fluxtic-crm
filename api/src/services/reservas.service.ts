/**
 * Servicio de creación de reservas (pre-reservas con seña).
 *
 * Es el corazón del sprint. Coordina:
 * - Validación de superposición
 * - Resolución de cliente (reusar existente por teléfono o crear nuevo)
 * - Cálculo de seña según servicio
 * - Creación atómica del Turno + PagoSena + preference MP
 *
 * TODO se hace en una transacción Prisma. Si MP falla, rollback completo.
 */

import { prisma } from '../lib/prisma'
import { asegurarSinSuperposicion } from '../utils/superposicion'
import { generateExternalReference } from '../utils/external-reference'
import { calcularSena } from './sena.service'
import { crearPreference } from './mercadopago.service'
import { errors } from '../utils/http-errors'
import type { OrigenReserva, OrigenCliente, Turno } from '@prisma/client'
import crypto from 'crypto'

export interface ClienteInput {
  nombre: string
  apellido?: string
  dni?: string
  telefono: string
  email?: string
  notas?: string
}

export type MetodoPagoElegido = 'MERCADOPAGO' | 'TRANSFERENCIA'

export interface CrearReservaInput {
  servicio_id: string
  profesional_id: string
  fecha_inicio: Date
  cliente: ClienteInput
  origen: OrigenReserva
  notas_turno?: string
  /**
   * Método elegido por la clienta cuando la config es `AMBOS`.
   * Ignorado si la config tiene un único método.
   */
  metodo_pago_elegido?: MetodoPagoElegido
  /**
   * Si true, no se cobra seña en este turno (queda CONFIRMADO directo).
   * Pensado para sesiones multi-servicio donde la seña va en el primer turno.
   */
  omitir_sena?: boolean
  /**
   * Si true, el turno queda en PENDIENTE sin generar link MP ni esperar
   * comprobante. El pago se coordina manualmente por WhatsApp con admin.
   */
  coordinar_por_whatsapp?: boolean
}

export interface CrearReservaOutput {
  turno: Turno
  cliente_id: string
  cliente_es_nuevo: boolean
  cliente_conflicto_datos?: boolean
  cliente_detalle_conflicto?: string
  requiere_pago: boolean
  metodo_pago: 'MERCADOPAGO' | 'TRANSFERENCIA' | null
  monto_sena: number
  init_point: string | null
  external_reference: string | null
  alias_transferencia: string | null
  titular_alias: string | null
  mensaje_sena: string | null
  reserva_expira_en: Date | null
}

/**
 * Crea una pre-reserva con todo el flujo de seña.
 *
 * Si el servicio no requiere seña → turno queda CONFIRMADO directamente.
 * Si requiere seña → turno queda PENDIENTE_PAGO_MP, expira en 15 min.
 */
export async function crearReserva(input: CrearReservaInput): Promise<CrearReservaOutput> {
  // Validaciones previas (fuera de transacción)
  validarTelefono(input.cliente.telefono)
  if (input.cliente.email) validarEmail(input.cliente.email)

  if (input.fecha_inicio.getTime() < Date.now()) {
    throw errors.badRequest('La fecha de la reserva no puede estar en el pasado')
  }

  const expiracionMin = parseInt(process.env.RESERVA_EXPIRACION_MINUTOS || '15', 10)

  // Todo dentro de una transacción atómica
  const result = await prisma.$transaction(async tx => {
    // 1. Cargar servicio (lock optimista — si cambia el precio entre lectura y guardado, se reintenta)
    const servicio = await tx.servicio.findUnique({
      where: { id: input.servicio_id, activo: true },
    })
    if (!servicio) {
      throw errors.notFound('Servicio')
    }

    // 2. Cargar profesional
    const profesional = await tx.usuario.findUnique({
      where: { id: input.profesional_id, activo: true },
      include: {
        horarios: {
          where: {
            activo: true,
            dia_semana: input.fecha_inicio.getDay(),
          },
        },
      },
    })
    if (!profesional) {
      throw errors.notFound('Profesional')
    }

    // 3. Validar que el horario está dentro de algún bloque laboral
    if (profesional.horarios.length === 0) {
      throw errors.badRequest('La profesional no trabaja ese día', 'FUERA_DE_HORARIO')
    }

    const horaSlot = formatHHmm(input.fecha_inicio)
    const finSlot = formatHHmm(new Date(input.fecha_inicio.getTime() + servicio.duracion_min * 60 * 1000))
    const dentroDeHorario = profesional.horarios.some(h => {
      return horaSlot >= h.hora_inicio && finSlot <= h.hora_fin
    })
    if (!dentroDeHorario) {
      throw errors.badRequest('El horario solicitado está fuera del horario laboral', 'FUERA_DE_HORARIO')
    }

    // 4. Validar superposición con buffer
    await asegurarSinSuperposicion(tx, {
      profesional_id: input.profesional_id,
      fecha_inicio: input.fecha_inicio,
      duracion_min: servicio.duracion_min,
      buffer_min: servicio.buffer_min,
    })

    // 5. Resolver cliente (reusar o crear)
    const { cliente, esNuevo, conflictoDatos, detalleConflicto } = await resolverCliente(tx, input.cliente, input.origen)

    // 6. Calcular seña (puede forzarse a SIN_SENA con omitir_sena)
    const sena = input.omitir_sena
      ? { requiere: false, monto: 0, motivo: 'omitida (sesión multi-servicio)' }
      : calcularSena(servicio)

    // 6.5 Resolver método de cobro según configuración del negocio
    // Si la política es AMBOS, la clienta puede elegir entre MP o transferencia.
    // Si es uno solo, se ignora la preferencia del input.
    const config = await tx.configuracionReservas.findFirst()
    const metodoConfig = config?.metodo_sena ?? 'MERCADOPAGO'
    const metodoElegido = resolverMetodoPago(metodoConfig, input.metodo_pago_elegido)

    // 7. Crear el turno
    // Si la seña va por transferencia, damos más ventana (configurable en horas).
    // Para "coordinar por WhatsApp", usamos la misma ventana que transferencia
    // (default 24h) para que el slot no quede bloqueado para siempre si la
    // clienta no contesta.
    const ventanaTransfMs = (config?.vencimiento_transf_horas ?? 24) * 60 * 60 * 1000
    const expiraEn = input.coordinar_por_whatsapp
      ? new Date(Date.now() + ventanaTransfMs)
      : !sena.requiere
        ? null
        : metodoElegido === 'TRANSFERENCIA'
          ? new Date(Date.now() + ventanaTransfMs)
          : new Date(Date.now() + expiracionMin * 60 * 1000)

    // Si la clienta va a coordinar por WhatsApp, el turno queda PENDIENTE
    // sin importar la config de seña. Admin lo confirma manualmente cuando
    // recibe el pago.
    const estadoInicial = input.coordinar_por_whatsapp
      ? 'PENDIENTE'
      : !sena.requiere
        ? 'CONFIRMADO'
        : metodoElegido === 'TRANSFERENCIA'
          ? (config?.estado_inicial_transf ?? 'PENDIENTE_VALIDACION_MANUAL')
          : (config?.estado_inicial_mp ?? 'PENDIENTE_PAGO_MP')

    const turno = await tx.turno.create({
      data: {
        cliente_id: cliente.id,
        servicio_id: servicio.id,
        profesional_id: profesional.id,
        fecha: input.fecha_inicio,
        duracion_min: servicio.duracion_min,
        precio: servicio.precio,
        estado: estadoInicial,
        sena: sena.requiere ? sena.monto : null,
        notas: input.notas_turno || null,
        monto_total: servicio.precio,
        monto_sena: sena.requiere ? sena.monto : null,
        sena_requerida: sena.requiere,
        reserva_expira_en: expiraEn,
        origen_reserva: input.origen,
      },
    })

    // 7.5. Rama: la clienta cierra el wizard y coordina pago por WhatsApp.
    // El turno queda PENDIENTE; no se genera link MP, ni alias, ni vencimiento.
    if (input.coordinar_por_whatsapp) {
      await tx.eventoN8n.create({
        data: {
          workflow_name: 'reserva_creada_coord_whatsapp',
          estado: 'EXITOSO',
          mensaje: `Turno ${turno.id} creado PENDIENTE, coordina pago por WhatsApp`,
          referencia_id: turno.id,
          payload: { turno_id: turno.id, origen: input.origen, monto_sugerido: sena.requiere ? sena.monto : 0 },
        },
      })

      return {
        turno,
        cliente_id: cliente.id,
        cliente_es_nuevo: esNuevo,
        cliente_conflicto_datos: conflictoDatos,
        cliente_detalle_conflicto: detalleConflicto,
        requiere_pago: sena.requiere,
        metodo_pago: null,
        monto_sena: sena.requiere ? sena.monto : 0,
        init_point: null,
        external_reference: null,
        alias_transferencia: null,
        titular_alias: null,
        mensaje_sena: null,
        reserva_expira_en: null,
      }
    }

    // 8. Si no requiere seña, terminamos acá
    if (!sena.requiere) {
      await tx.eventoN8n.create({
        data: {
          workflow_name: 'reserva_creada_sin_sena',
          estado: 'EXITOSO',
          mensaje: `Turno ${turno.id} creado y CONFIRMADO sin seña`,
          referencia_id: turno.id,
          payload: { turno_id: turno.id, origen: input.origen },
        },
      })

      return {
        turno,
        cliente_id: cliente.id,
        cliente_es_nuevo: esNuevo,
        cliente_conflicto_datos: conflictoDatos,
        cliente_detalle_conflicto: detalleConflicto,
        requiere_pago: false,
        metodo_pago: null as CrearReservaOutput['metodo_pago'],
        monto_sena: 0,
        init_point: null,
        external_reference: null,
        alias_transferencia: null,
        titular_alias: null,
        mensaje_sena: null,
        reserva_expira_en: null,
      }
    }

    // 9. Rama: TRANSFERENCIA al alias del negocio
    // No se genera preference MP. Se devuelve el alias para que la clienta
    // transfiera por homebanking. El turno queda PENDIENTE_VALIDACION_MANUAL
    // hasta que el admin apruebe el comprobante subido.
    if (metodoElegido === 'TRANSFERENCIA') {
      await tx.eventoN8n.create({
        data: {
          workflow_name: 'reserva_creada_transferencia',
          estado: 'EXITOSO',
          mensaje: `Turno ${turno.id} creado, esperando comprobante de transferencia`,
          referencia_id: turno.id,
          payload: {
            turno_id: turno.id,
            monto_sena: sena.monto,
            alias: config?.alias_transferencia ?? null,
            origen: input.origen,
            cliente_id: cliente.id,
          },
        },
      })

      return {
        turno,
        cliente_id: cliente.id,
        cliente_es_nuevo: esNuevo,
        cliente_conflicto_datos: conflictoDatos,
        cliente_detalle_conflicto: detalleConflicto,
        requiere_pago: true,
      	metodo_pago: 'TRANSFERENCIA' as CrearReservaOutput['metodo_pago'],
        monto_sena: sena.monto,
        init_point: null,
        external_reference: null,
        alias_transferencia: config?.alias_transferencia ?? null,
        titular_alias: config?.titular_alias ?? null,
        mensaje_sena: config?.mensaje_sena ?? null,
        reserva_expira_en: expiraEn,
      }
    }

    // 10. Rama: MERCADOPAGO (Checkout) — flujo original con preference
    const externalRef = generateExternalReference(turno.id)

    const preference = await crearPreference({
      external_reference: externalRef,
      amount: sena.monto,
      description: `Seña - ${servicio.nombre} - ${formatFecha(input.fecha_inicio)}`,
      payer: {
        name: cliente.nombre,
        surname: cliente.apellido || undefined,
        email: cliente.email || undefined,
        phone: cliente.telefono || undefined,
      },
    })

    await tx.pagoSena.create({
      data: {
        turno_id: turno.id,
        external_reference: externalRef,
        preference_id: preference.preference_id,
        init_point: preference.init_point,
        amount: sena.monto,
        currency: 'ARS',
        status: 'CREADO',
      },
    })

    const turnoActualizado = await tx.turno.update({
      where: { id: turno.id },
      data: {
        mp_preference_id: preference.preference_id,
        mp_init_point: preference.init_point,
        mp_external_reference: externalRef,
      },
    })

    await tx.eventoN8n.create({
      data: {
        workflow_name: 'reserva_creada_con_pago',
        estado: 'EXITOSO',
        mensaje: `Turno ${turno.id} creado, esperando pago de seña`,
        referencia_id: turno.id,
        payload: {
          turno_id: turno.id,
          monto_sena: sena.monto,
          external_reference: externalRef,
          preference_id: preference.preference_id,
          origen: input.origen,
          cliente_id: cliente.id,
        },
      },
    })

    return {
      turno: turnoActualizado,
      cliente_id: cliente.id,
      cliente_es_nuevo: esNuevo,
      cliente_conflicto_datos: conflictoDatos,
      cliente_detalle_conflicto: detalleConflicto,
      requiere_pago: true,
      metodo_pago: 'MERCADOPAGO' as CrearReservaOutput['metodo_pago'],
      monto_sena: sena.monto,
      init_point: preference.init_point,
      external_reference: externalRef,
      alias_transferencia: null,
      titular_alias: null,
      mensaje_sena: null,
      reserva_expira_en: expiraEn,
    }
  }, {
    timeout: 15000, // 15s — la transacción puede tardar por el call a MP
    isolationLevel: 'Serializable', // máxima protección contra race conditions de superposición
  })

  return result
}

// ─────────────────────────────────────────────────────────────────
// RESERVA MULTI-SERVICIO
// ─────────────────────────────────────────────────────────────────

export interface CrearReservaMultipleInput {
  servicios_ids: string[]
  profesional_id: string
  fecha_inicio: Date
  cliente: ClienteInput
  origen: OrigenReserva
  notas_turno?: string
}

export interface TurnoCreado {
  id: string
  servicio_id: string
  servicio_nombre: string
  fecha: Date
  duracion_min: number
  precio: number
  estado: string
  orden: number
}

export interface CrearReservaMultipleOutput {
  turnos: TurnoCreado[]
  grupo_reserva_id: string
  cliente_id: string
  cliente_es_nuevo: boolean
  requiere_pago: boolean
  monto_sena: number
  init_point: string | null
  external_reference: string | null
  reserva_expira_en: Date | null
}

/**
 * Crea múltiples turnos consecutivos para el mismo cliente/profesional.
 *
 * Regla de seña: solo el PRIMER servicio puede requerir seña.
 * Los servicios adicionales quedan CONFIRMADOS (sin seña) o en espera
 * del pago del primer turno si este requiere seña.
 *
 * Todo dentro de una única transacción Serializable + rollback completo si falla MP.
 */
export async function crearReservaMultiple(input: CrearReservaMultipleInput): Promise<CrearReservaMultipleOutput> {
  if (!input.servicios_ids || input.servicios_ids.length === 0) {
    throw errors.badRequest('Debe seleccionar al menos un servicio', 'SIN_SERVICIOS')
  }

  validarTelefono(input.cliente.telefono)
  if (input.cliente.email) validarEmail(input.cliente.email)

  if (input.fecha_inicio.getTime() < Date.now()) {
    throw errors.badRequest('La fecha de la reserva no puede estar en el pasado')
  }

  const expiracionMin = parseInt(process.env.RESERVA_EXPIRACION_MINUTOS || '15', 10)

  const result = await prisma.$transaction(async tx => {
    // 1. Cargar todos los servicios en orden
    const servicios = await Promise.all(
      input.servicios_ids.map(id =>
        tx.servicio.findUnique({ where: { id, activo: true } })
      )
    )

    for (let i = 0; i < servicios.length; i++) {
      if (!servicios[i]) {
        throw errors.badRequest(`Servicio en posición ${i + 1} no encontrado o inactivo`, 'SERVICIO_NO_ENCONTRADO')
      }
    }

    const serviciosValidos = servicios as NonNullable<typeof servicios[0]>[]

    // 2. Cargar profesional
    const diaSemana = input.fecha_inicio.getDay()
    const profesional = await tx.usuario.findUnique({
      where: { id: input.profesional_id, activo: true },
      include: {
        horarios: { where: { activo: true, dia_semana: diaSemana } },
      },
    })

    if (!profesional) {
      throw errors.notFound('Profesional')
    }

    if (profesional.horarios.length === 0) {
      throw errors.badRequest('La profesional no trabaja ese día', 'FUERA_DE_HORARIO')
    }

    // 3. Calcular slots consecutivos
    // Los servicios del mismo cliente se encadenan sin buffer entre ellos.
    // El buffer solo bloquea slots para OTROS clientes (la superposición se maneja por separado).
    type Slot = { inicio: Date; fin: Date; finEfectivo: Date }
    const slots: Slot[] = []
    let cursor = input.fecha_inicio

    for (const servicio of serviciosValidos) {
      const inicio = cursor
      const fin = new Date(inicio.getTime() + servicio.duracion_min * 60 * 1000)
      const finEfectivo = new Date(fin.getTime() + servicio.buffer_min * 60 * 1000)
      slots.push({ inicio, fin, finEfectivo })
      cursor = fin // próximo slot arranca donde termina el actual (sin buffer propio)
    }

    // 4. Validar que todos los slots entran dentro del horario laboral
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const horaInicio = formatHHmm(slot.inicio)
      const horaFin = formatHHmm(slot.finEfectivo)

      const dentroDeHorario = profesional.horarios.some(h =>
        horaInicio >= h.hora_inicio && horaFin <= h.hora_fin
      )

      if (!dentroDeHorario) {
        const svcNombre = serviciosValidos[i].nombre
        throw errors.badRequest(
          `El horario del servicio "${svcNombre}" (slot ${i + 1}) está fuera del horario laboral`,
          'FUERA_DE_HORARIO'
        )
      }
    }

    // 5. Validar superposición para cada slot (excluyendo los turnos que vamos a crear)
    // Como todos se crean en la misma transacción, comprobamos secuencialmente y excluimos
    // los IDs de turnos creados en los pasos anteriores (que serán llenados conforme avanzamos).
    // En realidad, como es Serializable y todos los turnos se crean en la misma tx,
    // los turnos del grupo no existen todavía en la DB cuando verificamos el overlap.
    // Solo necesitamos que no haya conflicto con turnos EXTERNOS.
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const servicio = serviciosValidos[i]

      await asegurarSinSuperposicion(tx, {
        profesional_id: input.profesional_id,
        fecha_inicio: slot.inicio,
        duracion_min: servicio.duracion_min,
        buffer_min: servicio.buffer_min,
      })
    }

    // 6. Resolver cliente
    const { cliente, esNuevo } = await resolverCliente(tx, input.cliente, input.origen)

    // 7. Calcular seña SOLO para el primer servicio (decisión de backend)
    const senaDelPrimero = calcularSena(serviciosValidos[0])
    const requiereSena = senaDelPrimero.requiere

    // 8. Generar grupo_reserva_id que vincula todos los turnos
    const grupoReservaId = crypto.randomUUID()

    const expiraEn = requiereSena
      ? new Date(Date.now() + expiracionMin * 60 * 1000)
      : null

    // 9. Crear todos los turnos
    const turnosCreados: TurnoCreado[] = []

    for (let i = 0; i < serviciosValidos.length; i++) {
      const servicio = serviciosValidos[i]
      const slot = slots[i]
      const esPrimero = i === 0

      // Solo el primer turno puede tener seña; el resto se confirma junto cuando el primero paga
      const estadoInicial = requiereSena ? 'PENDIENTE_PAGO_MP' : 'CONFIRMADO'

      const turno = await tx.turno.create({
        data: {
          cliente_id: cliente.id,
          servicio_id: servicio.id,
          profesional_id: profesional.id,
          fecha: slot.inicio,
          duracion_min: servicio.duracion_min,
          precio: servicio.precio,
          estado: estadoInicial,
          sena: esPrimero && requiereSena ? senaDelPrimero.monto : null,
          notas: input.notas_turno || null,
          monto_total: servicio.precio,
          monto_sena: esPrimero && requiereSena ? senaDelPrimero.monto : null,
          sena_requerida: esPrimero && requiereSena,
          reserva_expira_en: expiraEn,
          origen_reserva: input.origen,
          grupo_reserva_id: grupoReservaId,
        },
      })

      turnosCreados.push({
        id: turno.id,
        servicio_id: servicio.id,
        servicio_nombre: servicio.nombre,
        fecha: slot.inicio,
        duracion_min: servicio.duracion_min,
        precio: Number(servicio.precio),
        estado: estadoInicial,
        orden: i + 1,
      })
    }

    // 10. Si no requiere seña, terminamos
    if (!requiereSena) {
      await tx.eventoN8n.create({
        data: {
          workflow_name: 'reserva_multiple_sin_sena',
          estado: 'EXITOSO',
          mensaje: `${turnosCreados.length} turno(s) creados y CONFIRMADOS sin seña (grupo ${grupoReservaId})`,
          referencia_id: turnosCreados[0].id,
          payload: { grupo_reserva_id: grupoReservaId, turno_ids: turnosCreados.map(t => t.id), origen: input.origen },
        },
      })

      return {
        turnos: turnosCreados,
        grupo_reserva_id: grupoReservaId,
        cliente_id: cliente.id,
        cliente_es_nuevo: esNuevo,
        requiere_pago: false,
        monto_sena: 0,
        init_point: null,
        external_reference: null,
        reserva_expira_en: null,
      }
    }

    // 11. Requiere seña: crear MP preference para el PRIMER turno
    const primerTurnoId = turnosCreados[0].id
    const externalRef = generateExternalReference(primerTurnoId)

    const preference = await crearPreference({
      external_reference: externalRef,
      amount: senaDelPrimero.monto,
      description: `Seña - ${serviciosValidos.map(s => s.nombre).join(' + ')} - ${formatFecha(input.fecha_inicio)}`,
      payer: {
        name: cliente.nombre,
        surname: cliente.apellido || undefined,
        email: cliente.email || undefined,
        phone: cliente.telefono || undefined,
      },
    })

    // 12. Crear PagoSena para el primer turno
    await tx.pagoSena.create({
      data: {
        turno_id: primerTurnoId,
        external_reference: externalRef,
        preference_id: preference.preference_id,
        init_point: preference.init_point,
        amount: senaDelPrimero.monto,
        currency: 'ARS',
        status: 'CREADO',
      },
    })

    // 13. Actualizar primer turno con datos MP
    await tx.turno.update({
      where: { id: primerTurnoId },
      data: {
        mp_preference_id: preference.preference_id,
        mp_init_point: preference.init_point,
        mp_external_reference: externalRef,
      },
    })

    // 14. Log de evento
    await tx.eventoN8n.create({
      data: {
        workflow_name: 'reserva_multiple_con_pago',
        estado: 'EXITOSO',
        mensaje: `${turnosCreados.length} turno(s) creados, esperando pago (grupo ${grupoReservaId})`,
        referencia_id: primerTurnoId,
        payload: {
          grupo_reserva_id: grupoReservaId,
          turno_ids: turnosCreados.map(t => t.id),
          monto_sena: senaDelPrimero.monto,
          external_reference: externalRef,
          preference_id: preference.preference_id,
          origen: input.origen,
          cliente_id: cliente.id,
        },
      },
    })

    // Actualizar turnosCreados con datos del primer turno post-update
    turnosCreados[0] = {
      ...turnosCreados[0],
      estado: 'PENDIENTE_PAGO_MP',
    }

    return {
      turnos: turnosCreados,
      grupo_reserva_id: grupoReservaId,
      cliente_id: cliente.id,
      cliente_es_nuevo: esNuevo,
      requiere_pago: true,
      monto_sena: senaDelPrimero.monto,
      init_point: preference.init_point,
      external_reference: externalRef,
      reserva_expira_en: expiraEn,
    }
  }, {
    timeout: 20000,
    isolationLevel: 'Serializable',
  })

  return result
}

/**
 * Resuelve el cliente: si el teléfono ya existe, lo reusa.
 * Si no existe, crea uno nuevo.
 *
 * Política: NO sobrescribir datos del cliente existente.
 * Si el input tiene email pero el cliente DB no, se completa.
 * Si ya tiene email distinto, NO se pisa.
 */
export interface ResolverClienteResult {
  cliente: {
    id: string
    nombre: string
    apellido: string | null
    telefono: string | null
    email: string | null
    dni: string | null
  }
  esNuevo: boolean
  /** True si hubo diferencias entre los datos enviados y los registrados. */
  conflictoDatos?: boolean
  /** Texto humano describiendo el conflicto (se loguea en notas del cliente). */
  detalleConflicto?: string
}

/**
 * Resuelve el cliente con DNI como identificador principal.
 *
 * Reglas:
 *  A. Si DNI existe -> reusar. NO bloquear por teléfono/email distintos.
 *     Solo se completan campos vacíos; los conflictos se loguean en notas.
 *  B. Si DNI no existe -> buscar por teléfono.
 *     - Si el teléfono no tiene DNI: asignar el DNI y reusar.
 *     - Si el teléfono ya tiene OTRO DNI: error TELEFONO_OTRO_CLIENTE.
 *  C. Si nada coincide -> crear cliente nuevo.
 *
 * Devuelve un flag conflictoDatos para que el llamador notifique sin bloquear.
 */
async function resolverCliente(
  tx: any,
  input: ClienteInput,
  origen: OrigenReserva
): Promise<ResolverClienteResult> {
  const telefonoNormalizado = normalizarTelefono(input.telefono)
  const dniLimpio = input.dni ? input.dni.replace(/\D/g, '') : ''
  const emailLimpio = input.email?.trim() || ''

  // ── A. DNI ya existe en la DB ──────────────────────────────────────────
  if (dniLimpio) {
    const porDni = await tx.cliente.findUnique({ where: { dni: dniLimpio } })
    if (porDni) {
      const updates: Record<string, unknown> = {}
      const conflictos: string[] = []

      // Telefono: completar si vacio. Si el cliente ya tiene otro telefono,
      // NO pisar y registrar conflicto.
      if (telefonoNormalizado) {
        if (!porDni.telefono) {
          // Solo asignar si el telefono NO esta tomado por otro cliente
          const otroPorTel = await tx.cliente.findUnique({ where: { telefono: telefonoNormalizado } })
          if (otroPorTel) {
            conflictos.push(`teléfono ${telefonoNormalizado} pertenece a otro cliente (${otroPorTel.id})`)
          } else {
            updates.telefono = telefonoNormalizado
          }
        } else if (porDni.telefono !== telefonoNormalizado) {
          conflictos.push(`teléfono enviado ${telefonoNormalizado} difiere del registrado ${porDni.telefono}`)
        }
      }

      // Email: idem
      if (emailLimpio) {
        if (!porDni.email) {
          const otroPorEmail = await tx.cliente.findUnique({ where: { email: emailLimpio } })
          if (otroPorEmail) {
            conflictos.push(`email ${emailLimpio} pertenece a otro cliente (${otroPorEmail.id})`)
          } else {
            updates.email = emailLimpio
          }
        } else if (porDni.email !== emailLimpio) {
          conflictos.push(`email enviado ${emailLimpio} difiere del registrado ${porDni.email}`)
        }
      }

      // Nombre / apellido: completar si vacios, registrar diferencia si distintos
      if (!porDni.apellido && input.apellido) {
        updates.apellido = input.apellido
      } else if (input.apellido && porDni.apellido && porDni.apellido !== input.apellido) {
        conflictos.push(`apellido enviado "${input.apellido}" difiere del registrado "${porDni.apellido}"`)
      }
      if (input.nombre && porDni.nombre && porDni.nombre !== input.nombre) {
        conflictos.push(`nombre enviado "${input.nombre}" difiere del registrado "${porDni.nombre}"`)
      }

      // Si hubo diferencias, append a notas internas (sin pisar).
      if (conflictos.length > 0) {
        const stamp = new Date().toISOString().slice(0, 10)
        const linea = `[${stamp}] Reserva con datos divergentes: ${conflictos.join('; ')}`
        updates.notas = porDni.notas ? `${porDni.notas}\n${linea}` : linea
        console.warn(`[resolverCliente] Cliente ${porDni.id}: ${linea}`)
      }

      const cliente = Object.keys(updates).length > 0
        ? await tx.cliente.update({ where: { id: porDni.id }, data: updates })
        : porDni

      return {
        cliente,
        esNuevo: false,
        conflictoDatos: conflictos.length > 0,
        detalleConflicto: conflictos.length > 0 ? conflictos.join('; ') : undefined,
      }
    }
  }

  // ── B. DNI no existe en la DB. Buscar por teléfono. ───────────────────
  const porTel = telefonoNormalizado
    ? await tx.cliente.findUnique({ where: { telefono: telefonoNormalizado } })
    : null

  if (porTel) {
    // Conflicto duro: el teléfono ya tiene un DNI distinto al ingresado.
    if (porTel.dni && dniLimpio && porTel.dni !== dniLimpio) {
      throw errors.badRequest(
        'El teléfono ya está asociado a otro cliente. Revisá los datos o contactanos por WhatsApp.',
        'TELEFONO_OTRO_CLIENTE',
      )
    }

    const updates: Record<string, unknown> = {}
    if (!porTel.dni && dniLimpio) updates.dni = dniLimpio
    if (!porTel.email && emailLimpio) {
      const otroPorEmail = await tx.cliente.findUnique({ where: { email: emailLimpio } })
      if (!otroPorEmail) updates.email = emailLimpio
    }
    if (!porTel.apellido && input.apellido) updates.apellido = input.apellido

    const cliente = Object.keys(updates).length > 0
      ? await tx.cliente.update({ where: { id: porTel.id }, data: updates })
      : porTel

    return { cliente, esNuevo: false }
  }

  // ── C. Cliente totalmente nuevo. ──────────────────────────────────────
  // Si el email ya pertenece a otro cliente (sin DNI ni teléfono compartidos),
  // creamos el cliente sin email para no romper la constraint unique.
  let emailFinal = emailLimpio
  if (emailFinal) {
    const otroPorEmail = await tx.cliente.findUnique({ where: { email: emailFinal } })
    if (otroPorEmail) {
      console.warn(`[resolverCliente] Email ${emailFinal} ya pertenece a cliente ${otroPorEmail.id}. Creando sin email.`)
      emailFinal = ''
    }
  }

  const nuevo = await tx.cliente.create({
    data: {
      nombre: input.nombre,
      apellido: input.apellido || null,
      dni: dniLimpio || null,
      telefono: telefonoNormalizado,
      email: emailFinal || null,
      origen: mapOrigenReservaACliente(origen),
      notas: input.notas || null,
    },
  })
  return { cliente: nuevo, esNuevo: true }
}

function mapOrigenReservaACliente(origen: OrigenReserva): OrigenCliente {
  switch (origen) {
    case 'LINK_PUBLICO': return 'LINK_PUBLICO'
    case 'WHATSAPP': return 'WHATSAPP'
    case 'INSTAGRAM': return 'INSTAGRAM_DM'
    case 'TIENDANUBE': return 'TIENDANUBE'
    case 'ADMIN':
    default: return 'MANUAL'
  }
}

/**
 * Validación de teléfono argentino.
 * Acepta:
 *   +5493415550011
 *   54 9 341 555-0011
 *   3415550011
 *   341-555-0011
 * Normaliza a: +5493415550011 (con +549 prefix)
 */
const TELEFONO_AR_REGEX = /^[\d\s\-\+\(\)]{10,}$/

export function validarTelefono(telefono: string): void {
  if (!telefono || typeof telefono !== 'string') {
    throw errors.badRequest('Teléfono es requerido', 'TELEFONO_INVALIDO')
  }
  if (!TELEFONO_AR_REGEX.test(telefono)) {
    throw errors.badRequest('Formato de teléfono inválido', 'TELEFONO_INVALIDO')
  }
  const soloDigitos = telefono.replace(/\D/g, '')
  if (soloDigitos.length < 10 || soloDigitos.length > 15) {
    throw errors.badRequest('El teléfono debe tener entre 10 y 15 dígitos', 'TELEFONO_INVALIDO')
  }
}

export function normalizarTelefono(telefono: string): string {
  let digitos = telefono.replace(/\D/g, '')

  // Si arranca con 0 o 15 (formatos viejos AR), los removemos
  if (digitos.startsWith('0')) digitos = digitos.substring(1)

  // Si no arranca con 54, asumimos AR y agregamos
  if (!digitos.startsWith('54')) {
    digitos = '54' + digitos
  }

  // Si después del 54 no viene 9 (móvil AR), lo agregamos
  // (asumimos siempre celular para WhatsApp)
  if (!digitos.startsWith('549') && digitos.startsWith('54')) {
    digitos = '549' + digitos.substring(2)
  }

  return '+' + digitos
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validarEmail(email: string): void {
  if (!email || typeof email !== 'string') {
    throw errors.badRequest('Email es requerido', 'EMAIL_INVALIDO')
  }
  if (!EMAIL_REGEX.test(email)) {
    throw errors.badRequest('Formato de email inválido', 'EMAIL_INVALIDO')
  }
}

function formatHHmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function formatFecha(d: Date): string {
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Resuelve qué método de cobro usar para la seña.
 *
 * - SIN_SENA  → no debería llegar acá (se chequea antes con sena.requiere)
 * - MERCADOPAGO → siempre MP, ignora la preferencia del input
 * - TRANSFERENCIA → siempre transferencia, ignora la preferencia
 * - AMBOS → respeta lo que pidió la clienta (default MP si no especifica)
 */
function resolverMetodoPago(
  metodoConfig: 'MERCADOPAGO' | 'TRANSFERENCIA' | 'AMBOS' | 'SIN_SENA',
  elegidoPorCliente?: MetodoPagoElegido
): MetodoPagoElegido {
  if (metodoConfig === 'TRANSFERENCIA') return 'TRANSFERENCIA'
  if (metodoConfig === 'MERCADOPAGO') return 'MERCADOPAGO'
  if (metodoConfig === 'AMBOS') {
    return elegidoPorCliente === 'TRANSFERENCIA' ? 'TRANSFERENCIA' : 'MERCADOPAGO'
  }
  return 'MERCADOPAGO'
}
