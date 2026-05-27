import { addDays, addMinutes, format, isSameDay, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

export type VistaAgenda = 'dia' | 'semana' | 'mes'

export const HORA_INICIO = 7
export const HORA_FIN = 21
export const SLOT_MIN = 30 // visualización

export function rangoVista(d: Date, vista: VistaAgenda): { desde: Date; hasta: Date } {
  if (vista === 'dia') {
    const desde = new Date(d); desde.setHours(0, 0, 0, 0)
    const hasta = new Date(d); hasta.setHours(23, 59, 59, 999)
    return { desde, hasta }
  }
  if (vista === 'semana') {
    const desde = startOfWeek(d, { weekStartsOn: 1 })
    const hasta = endOfWeek(d, { weekStartsOn: 1 })
    desde.setHours(0, 0, 0, 0); hasta.setHours(23, 59, 59, 999)
    return { desde, hasta }
  }
  // mes
  const desde = new Date(d.getFullYear(), d.getMonth(), 1)
  const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { desde, hasta }
}

export function diasSemana(d: Date): Date[] {
  const inicio = startOfWeek(d, { weekStartsOn: 1 })
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(inicio, i))
}

export function generarSlotsHorarios(): string[] {
  const out: string[] = []
  for (let h = HORA_INICIO; h < HORA_FIN; h++) {
    for (let m = 0; m < 60; m += SLOT_MIN) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
}

export function colorEstado(estado: string): { bg: string; fg: string; border: string; label: string } {
  switch (estado) {
    case 'PENDIENTE':                 return { bg: 'var(--warning-l)', fg: 'var(--warning)', border: 'var(--warning)', label: 'Pendiente' }
    case 'PENDIENTE_PAGO_MP':         return { bg: 'var(--info-l)', fg: 'var(--info)', border: 'var(--info)', label: 'Pendiente pago' }
    case 'PENDIENTE_VALIDACION_MANUAL': return { bg: 'var(--info-l)', fg: 'var(--info)', border: 'var(--info)', label: 'Validación manual' }
    case 'CONFIRMADO':                return { bg: 'var(--clinical-l)', fg: 'var(--clinical)', border: 'var(--clinical)', label: 'Confirmado' }
    case 'EN_SALA_ESPERA':            return { bg: '#FEF3C7', fg: '#B45309', border: '#B45309', label: 'En sala espera' }
    case 'EN_ATENCION':               return { bg: 'var(--teal-l)', fg: 'var(--teal-d)', border: 'var(--teal-d)', label: 'En atención' }
    case 'ATENDIDO':                  return { bg: 'var(--salud-l)', fg: 'var(--salud)', border: 'var(--salud)', label: 'Atendido' }
    case 'CANCELADO':                 return { bg: 'var(--danger-l)', fg: 'var(--danger)', border: 'var(--danger)', label: 'Cancelado' }
    case 'AUSENTE':                   return { bg: 'var(--bg-3)', fg: 'var(--muted)', border: 'var(--muted)', label: 'Ausente' }
    case 'VENCIDO':                   return { bg: 'var(--bg-3)', fg: 'var(--muted)', border: 'var(--muted)', label: 'Vencido' }
    default:                          return { bg: 'var(--bg-2)', fg: 'var(--noir)', border: 'var(--border-2)', label: estado }
  }
}

export function transicionesPermitidas(estado: string): Array<{ estado: string; label: string }> {
  switch (estado) {
    case 'PENDIENTE':
      return [
        { estado: 'CONFIRMADO', label: 'Confirmar' },
        { estado: 'CANCELADO', label: 'Cancelar' },
        { estado: 'AUSENTE', label: 'Marcar ausente' },
      ]
    case 'CONFIRMADO':
      return [
        { estado: 'EN_SALA_ESPERA', label: 'Ingresar a sala' },
        { estado: 'CANCELADO', label: 'Cancelar' },
        { estado: 'AUSENTE', label: 'Marcar ausente' },
      ]
    case 'EN_SALA_ESPERA':
      return [
        { estado: 'EN_ATENCION', label: 'Iniciar atención' },
        { estado: 'CANCELADO', label: 'Cancelar' },
      ]
    case 'EN_ATENCION':
      return [{ estado: 'ATENDIDO', label: 'Finalizar atención' }]
    default:
      return []
  }
}

export function fmtFecha(d: Date | string, formato: string = 'dd/MM/yyyy'): string {
  return format(typeof d === 'string' ? new Date(d) : d, formato, { locale: es })
}

export function fmtHora(d: Date | string): string {
  return format(typeof d === 'string' ? new Date(d) : d, 'HH:mm')
}

export function fmtRango(d: Date | string, duracionMin: number): string {
  const inicio = typeof d === 'string' ? new Date(d) : d
  return `${fmtHora(inicio)}–${fmtHora(addMinutes(inicio, duracionMin))}`
}

export { isSameDay, addDays, addMinutes, startOfWeek, endOfWeek, format }
