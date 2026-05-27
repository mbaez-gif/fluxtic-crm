/**
 * Motor de reserva pública / portal paciente / n8n.
 *
 * Crea o reusa Paciente, valida slot, crea Turno, calcula copago previo si
 * corresponde, genera preference de MP si el método elegido es MP, y deja el
 * turno en el estado correcto:
 *   - PENDIENTE (sin copago previo, confirmación admin manual)
 *   - PENDIENTE_PAGO_MP (esperando que el paciente pague seña por MP)
 *   - PENDIENTE_VALIDACION_MANUAL (esperando comprobante de transferencia)
 *   - CONFIRMADO (directo, sin requisitos)
 *
 * Adaptado del motor de reservas Delfina Paz.
 */

import { prisma } from '../lib/prisma'
import { calcularSenaPrevia } from './copago.service'
import { crearPreference } from './mercadopago.service'
import { generateExternalReference } from '../utils/external-reference'
import { ESTADOS_BLOQUEANTES } from './disponibilidad.service'

export interface CrearReservaInput {
  prestacion_id: string
  profesional_id: string
  sede_id: string
  consultorio_id?: string | null
  fecha_hora: Date
  modalidad?: 'PRESENCIAL' | 'VIRTUAL'
  motivo_consulta?: string | null
  paciente: {
    dni: string
    nombre: string
    apellido: string
    telefono?: string | null
    email?: string | null
    fecha_nacimiento?: Date | null
    cobertura_id?: string | null
    plan_id?: string | null
    numero_afiliado?: string | null
  }
  metodo_copago_preferido?: 'MERCADOPAGO' | 'TRANSFERENCIA' | 'SIN_COPAGO'
  origen: 'PORTAL_PACIENTE' | 'LINK_PUBLICO' | 'WHATSAPP' | 'N8N' | 'TELEFONO' | 'ADMIN'
}

export interface CrearReservaOutput {
  ok: true
  turno_id: string
  paciente_id: string
  paciente_es_nuevo: boolean
  estado_turno: string
  requiere_pago: boolean
  metodo_pago: 'SIN_COPAGO' | 'MERCADOPAGO' | 'TRANSFERENCIA' | 'AMBOS'
  monto_copago: number | null
  init_point: string | null
  external_reference: string | null
  reserva_expira_en: Date | null
}

export async function crearReserva(input: CrearReservaInput): Promise<CrearReservaOutput> {
  // 1. Validar prestación
  const prestacion = await prisma.prestacion.findUnique({ where: { id: input.prestacion_id } })
  if (!prestacion || !prestacion.activa) {
    const e: any = new Error('Prestación no encontrada o inactiva')
    e.statusCode = 404
    throw e
  }

  // 2. Validar profesional habilitado para esa prestación
  const habilitado = await prisma.profesionalPrestacion.findUnique({
    where: { profesional_id_prestacion_id: { profesional_id: input.profesional_id, prestacion_id: input.prestacion_id } },
  })
  if (!habilitado) {
    const e: any = new Error('Profesional no habilitado para esta prestación')
    e.statusCode = 400
    throw e
  }

  // 3. Validar slot libre
  const fin = new Date(input.fecha_hora.getTime() + prestacion.duracion_min * 60 * 1000)
  const conflicto = await prisma.turno.findFirst({
    where: {
      profesional_id: input.profesional_id,
      estado: { in: ESTADOS_BLOQUEANTES },
      fecha_hora: { lt: fin },
    },
  })
  if (conflicto) {
    const conflFin = new Date(conflicto.fecha_hora.getTime() + conflicto.duracion_min * 60 * 1000)
    if (conflFin > input.fecha_hora) {
      const e: any = new Error('Slot ocupado, elegí otro horario')
      e.statusCode = 409
      throw e
    }
  }

  // 4. Upsert de paciente por DNI
  let pacienteId: string
  let esNuevo = false
  const existente = await prisma.paciente.findUnique({ where: { dni: input.paciente.dni } })
  if (existente) {
    pacienteId = existente.id
    // Actualizar datos básicos si vinieron y faltaban
    const updates: any = {}
    if (input.paciente.telefono && !existente.telefono) updates.telefono = input.paciente.telefono
    if (input.paciente.email && !existente.email) updates.email = input.paciente.email
    if (Object.keys(updates).length > 0) {
      await prisma.paciente.update({ where: { id: pacienteId }, data: updates })
    }
  } else {
    const nuevo = await prisma.paciente.create({
      data: {
        dni: input.paciente.dni,
        nombre: input.paciente.nombre,
        apellido: input.paciente.apellido,
        telefono: input.paciente.telefono ?? null,
        email: input.paciente.email ?? null,
        fecha_nacimiento: input.paciente.fecha_nacimiento ?? null,
        estado: 'ACTIVO',
      },
    })
    await prisma.historiaClinica.create({ data: { paciente_id: nuevo.id } })
    pacienteId = nuevo.id
    esNuevo = true
  }

  // 5. Agregar cobertura si vino
  let pacienteCoberturaId: string | null = null
  if (input.paciente.cobertura_id && input.paciente.numero_afiliado) {
    const yaTiene = await prisma.pacienteCobertura.findFirst({
      where: { paciente_id: pacienteId, cobertura_id: input.paciente.cobertura_id, activa: true },
    })
    if (yaTiene) {
      pacienteCoberturaId = yaTiene.id
    } else {
      const nueva = await prisma.pacienteCobertura.create({
        data: {
          paciente_id: pacienteId,
          cobertura_id: input.paciente.cobertura_id,
          plan_id: input.paciente.plan_id ?? null,
          numero_afiliado: input.paciente.numero_afiliado,
          principal: true,
        },
      })
      pacienteCoberturaId = nueva.id
    }
  } else {
    // Buscar cobertura principal del paciente
    const principal = await prisma.pacienteCobertura.findFirst({
      where: { paciente_id: pacienteId, principal: true, activa: true },
    })
    pacienteCoberturaId = principal?.id ?? null
  }

  // 6. Calcular seña previa según configuración
  const calculo = await calcularSenaPrevia(prestacion, pacienteCoberturaId)

  // 7. Decidir estado inicial del turno
  let estado: 'PENDIENTE' | 'PENDIENTE_PAGO_MP' | 'PENDIENTE_VALIDACION_MANUAL' = 'PENDIENTE'
  let metodoElegido: 'SIN_COPAGO' | 'MERCADOPAGO' | 'TRANSFERENCIA' | 'AMBOS' = 'SIN_COPAGO'
  let initPoint: string | null = null
  let externalRef: string | null = null
  let expiraEn: Date | null = null

  if (calculo.requiere) {
    const preferido = input.metodo_copago_preferido
    if (preferido === 'MERCADOPAGO' || (calculo.metodo === 'MERCADOPAGO' && !preferido)) {
      metodoElegido = 'MERCADOPAGO'
      estado = 'PENDIENTE_PAGO_MP'
    } else if (preferido === 'TRANSFERENCIA' || (calculo.metodo === 'TRANSFERENCIA' && !preferido)) {
      metodoElegido = 'TRANSFERENCIA'
      estado = 'PENDIENTE_VALIDACION_MANUAL'
    } else {
      // AMBOS: el frontend ofrece elegir, por defecto arrancamos con MP
      metodoElegido = 'MERCADOPAGO'
      estado = 'PENDIENTE_PAGO_MP'
    }
  }

  // 8. Crear turno + (si aplica) PagoMercadoPago
  const expiracionMin = parseInt(process.env.RESERVA_EXPIRACION_MINUTOS ?? '30', 10)
  const turno = await prisma.turno.create({
    data: {
      paciente_id: pacienteId,
      profesional_id: input.profesional_id,
      prestacion_id: input.prestacion_id,
      sede_id: input.sede_id,
      consultorio_id: input.consultorio_id ?? null,
      fecha_hora: input.fecha_hora,
      duracion_min: prestacion.duracion_min,
      modalidad: input.modalidad ?? 'PRESENCIAL',
      estado,
      motivo_consulta: input.motivo_consulta ?? null,
      requiere_copago: calculo.requiere,
      monto_total: prestacion.precio_particular,
      monto_copago: calculo.requiere ? (calculo.monto as any) : null,
      metodo_copago: metodoElegido,
      origen_reserva: input.origen,
      reserva_expira_en: estado !== 'PENDIENTE' ? new Date(Date.now() + expiracionMin * 60 * 1000) : null,
    },
  })

  if (estado === 'PENDIENTE_PAGO_MP') {
    externalRef = generateExternalReference(turno.id)
    const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } })
    const preference = await crearPreference({
      external_reference: externalRef,
      amount: calculo.monto,
      description: `${prestacion.nombre} — ${paciente?.nombre} ${paciente?.apellido}`,
      payer: {
        name: paciente?.nombre,
        surname: paciente?.apellido,
        email: paciente?.email ?? undefined,
        phone: paciente?.telefono ?? undefined,
      },
    })
    initPoint = preference.init_point
    await prisma.pagoMercadoPago.create({
      data: {
        turno_id: turno.id,
        external_reference: externalRef,
        preference_id: preference.preference_id,
        init_point: preference.init_point,
        amount: calculo.monto as any,
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
    expiraEn = new Date(Date.now() + expiracionMin * 60 * 1000)
  } else if (estado === 'PENDIENTE_VALIDACION_MANUAL') {
    expiraEn = new Date(Date.now() + expiracionMin * 60 * 1000)
  }

  await prisma.cambioEstadoTurno.create({
    data: { turno_id: turno.id, estado_nuevo: estado },
  })

  return {
    ok: true,
    turno_id: turno.id,
    paciente_id: pacienteId,
    paciente_es_nuevo: esNuevo,
    estado_turno: estado,
    requiere_pago: calculo.requiere,
    metodo_pago: metodoElegido,
    monto_copago: calculo.requiere ? calculo.monto : null,
    init_point: initPoint,
    external_reference: externalRef,
    reserva_expira_en: expiraEn,
  }
}
