/**
 * Servicio de cálculo de seña.
 *
 * Centraliza la regla: dado un Servicio con su configuración de seña,
 * devuelve si requiere seña y cuánto.
 */

import type { Servicio } from '@prisma/client'

export interface SenaCalculo {
  requiere: boolean
  monto: number
  motivo?: string  // si requiere=false, por qué
}

/**
 * Calcula la seña para un servicio dado.
 * El cálculo se hace en JS con números, asumiendo que los montos están en pesos
 * con dos decimales (no centavos). Redondeo a 2 decimales.
 */
export function calcularSena(servicio: Pick<Servicio, 'sena_tipo' | 'sena_porcentaje' | 'sena_monto_fijo' | 'precio'>): SenaCalculo {
  const precio = Number(servicio.precio)

  switch (servicio.sena_tipo) {
    case 'SIN_SENA':
      return { requiere: false, monto: 0, motivo: 'Servicio sin seña configurada' }

    case 'PORCENTAJE': {
      if (servicio.sena_porcentaje === null || servicio.sena_porcentaje === undefined) {
        // Configuración inconsistente: tipo PORCENTAJE pero sin porcentaje cargado.
        // Logueamos y tratamos como SIN_SENA en lugar de tirar error
        // (mejor UX: la clienta puede reservar, el admin verá el bug).
        console.warn(
          `[sena.service] Servicio con sena_tipo=PORCENTAJE pero sin sena_porcentaje. Se trata como SIN_SENA.`
        )
        return { requiere: false, monto: 0, motivo: 'Configuración de seña incompleta' }
      }

      const porcentaje = Number(servicio.sena_porcentaje)
      const monto = round2(precio * porcentaje / 100)

      // Validación: porcentaje debe estar entre 0 y 100
      if (porcentaje <= 0 || porcentaje > 100) {
        console.warn(
          `[sena.service] sena_porcentaje fuera de rango: ${porcentaje}. Se trata como SIN_SENA.`
        )
        return { requiere: false, monto: 0, motivo: 'Porcentaje de seña fuera de rango' }
      }

      // Si el monto calculado es 0 o muy chico, no requerimos pago
      if (monto < 1) {
        return { requiere: false, monto: 0, motivo: 'Monto de seña menor a $1' }
      }

      return { requiere: true, monto }
    }

    case 'MONTO_FIJO': {
      if (servicio.sena_monto_fijo === null || servicio.sena_monto_fijo === undefined) {
        console.warn(
          `[sena.service] Servicio con sena_tipo=MONTO_FIJO pero sin sena_monto_fijo. Se trata como SIN_SENA.`
        )
        return { requiere: false, monto: 0, motivo: 'Configuración de seña incompleta' }
      }

      const montoConfigurado = Number(servicio.sena_monto_fijo)

      // Caso borde: seña configurada > precio del servicio. La capamos a precio total.
      if (montoConfigurado > precio) {
        console.warn(
          `[sena.service] sena_monto_fijo (${montoConfigurado}) > precio (${precio}). Capeo a precio.`
        )
        return { requiere: true, monto: precio }
      }

      if (montoConfigurado < 1) {
        return { requiere: false, monto: 0, motivo: 'Monto de seña menor a $1' }
      }

      return { requiere: true, monto: round2(montoConfigurado) }
    }

    default:
      console.warn(`[sena.service] sena_tipo desconocido: ${servicio.sena_tipo}`)
      return { requiere: false, monto: 0, motivo: 'Tipo de seña no reconocido' }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Validación de configuración de seña (para usar en CRUD de servicios).
 * Devuelve string con error o null si OK.
 */
export function validarConfigSena(input: {
  sena_tipo: string
  sena_porcentaje?: number | null
  sena_monto_fijo?: number | null
}): string | null {
  switch (input.sena_tipo) {
    case 'SIN_SENA':
      return null

    case 'PORCENTAJE':
      if (input.sena_porcentaje === null || input.sena_porcentaje === undefined) {
        return 'sena_porcentaje es requerido cuando sena_tipo es PORCENTAJE'
      }
      if (input.sena_porcentaje <= 0 || input.sena_porcentaje > 100) {
        return 'sena_porcentaje debe estar entre 0 y 100'
      }
      return null

    case 'MONTO_FIJO':
      if (input.sena_monto_fijo === null || input.sena_monto_fijo === undefined) {
        return 'sena_monto_fijo es requerido cuando sena_tipo es MONTO_FIJO'
      }
      if (input.sena_monto_fijo <= 0) {
        return 'sena_monto_fijo debe ser mayor a 0'
      }
      return null

    default:
      return `sena_tipo inválido: ${input.sena_tipo}`
  }
}
