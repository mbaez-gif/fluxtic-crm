/**
 * Servicio de cálculo de copago / seña previa.
 *
 * Reglas:
 * - Si la clínica configura `requiere_sena=true` (ConfiguracionFacturacion),
 *   se pide seña previa antes de confirmar el turno.
 * - El monto de seña puede ser un porcentaje del precio o un monto fijo.
 * - Si el paciente tiene cobertura activa, el copago se calcula sobre el
 *   restante después de aplicar el porcentaje de cobertura.
 *
 * Adaptado de Delfina Paz `services/sena.service.ts` al dominio clínico.
 */

import { prisma } from '../lib/prisma'
import type { Prestacion } from '@prisma/client'

export interface CalculoCopago {
  requiere: boolean
  monto: number
  metodo: 'SIN_COPAGO' | 'MERCADOPAGO' | 'TRANSFERENCIA' | 'AMBOS'
  motivo?: string
}

/**
 * Determina si una prestación requiere seña previa para reservar el turno.
 * Lee la ConfiguracionFacturacion singleton.
 */
export async function calcularSenaPrevia(
  prestacion: Pick<Prestacion, 'precio_particular'>,
  pacienteCoberturaId?: string | null,
): Promise<CalculoCopago> {
  const config = await prisma.configuracionFacturacion.findUnique({
    where: { id: 'singleton' },
  })

  if (!config?.requiere_sena) {
    return { requiere: false, monto: 0, metodo: 'SIN_COPAGO', motivo: 'Clínica no exige seña previa' }
  }

  const precio = Number(prestacion.precio_particular)

  // Si el paciente tiene cobertura, el copago se reduce por el porcentaje cubierto
  let baseCalculo = precio
  if (pacienteCoberturaId) {
    const cobertura = await prisma.pacienteCobertura.findUnique({
      where: { id: pacienteCoberturaId },
      include: { plan: true },
    })
    if (cobertura?.plan?.porcentaje_cobertura) {
      const cubierto = Number(cobertura.plan.porcentaje_cobertura)
      baseCalculo = round2(precio * (100 - cubierto) / 100)
    }
  }

  // Calcular monto de seña previa
  let monto = 0
  if (config.porcentaje_sena) {
    const pct = Number(config.porcentaje_sena)
    monto = round2(baseCalculo * pct / 100)
  } else if (config.monto_sena_default) {
    monto = Number(config.monto_sena_default)
    if (monto > baseCalculo) monto = baseCalculo
  }

  if (monto < 1) {
    return { requiere: false, monto: 0, metodo: 'SIN_COPAGO', motivo: 'Monto calculado menor a $1' }
  }

  // Decidir método según config
  const aceptaMp = config.acepta_mercadopago
  const aceptaTransfer = config.acepta_transferencia
  let metodo: CalculoCopago['metodo'] = 'SIN_COPAGO'
  if (aceptaMp && aceptaTransfer) metodo = 'AMBOS'
  else if (aceptaMp) metodo = 'MERCADOPAGO'
  else if (aceptaTransfer) metodo = 'TRANSFERENCIA'

  return { requiere: true, monto, metodo }
}

/**
 * Calcula el copago final (a cobrar en caja al atender) según cobertura.
 * Se usa al facturar después de la atención.
 */
export async function calcularCopagoCobranza(
  prestacionId: string,
  pacienteCoberturaId?: string | null,
): Promise<{ total: number; copago_paciente: number; cubierto_obra_social: number }> {
  const prestacion = await prisma.prestacion.findUnique({ where: { id: prestacionId } })
  if (!prestacion) throw new Error(`Prestacion ${prestacionId} no encontrada`)
  const total = Number(prestacion.precio_particular)

  if (!pacienteCoberturaId) {
    return { total, copago_paciente: total, cubierto_obra_social: 0 }
  }

  const cobertura = await prisma.pacienteCobertura.findUnique({
    where: { id: pacienteCoberturaId },
    include: { plan: true },
  })
  if (!cobertura?.plan?.porcentaje_cobertura) {
    return { total, copago_paciente: total, cubierto_obra_social: 0 }
  }

  const pctCubierto = Number(cobertura.plan.porcentaje_cobertura)
  const cubierto = round2(total * pctCubierto / 100)
  const copago = round2(total - cubierto)
  return { total, copago_paciente: copago, cubierto_obra_social: cubierto }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
