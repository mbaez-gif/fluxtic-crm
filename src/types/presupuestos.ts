import type { Timestamp } from 'firebase/firestore'

export type PresupuestoEstado = 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'vencido'

export interface PresupuestoItem {
  id:          string
  descripcion: string
  horas:       number
  valorHora:   number
  subtotal:    number
  notas:       string
}

export interface Presupuesto {
  id:            string
  numero:        string          // PRES-0001
  clienteId?:    string
  clienteNombre: string
  clienteEmail:  string
  clienteTel:    string
  empresa:       string
  items:         PresupuestoItem[]
  subtotal:      number
  iva:           number           // porcentaje, ej 21
  descuento:     number           // porcentaje
  total:         number
  moneda:        'ARS' | 'USD'
  validezDias:   number
  estado:        PresupuestoEstado
  notas:         string
  condiciones:   string
  creadoPorUid:  string
  creadoPorNombre: string
  creadoEn:      Timestamp
  actualizadoEn: Timestamp
  enviadoEn?:    Timestamp
  aceptadoEn?:   Timestamp
}

export const ESTADO_PRESUPUESTO: Record<PresupuestoEstado, { label: string; color: string }> = {
  borrador:  { label: 'Borrador',  color: 'text-flux-text3 bg-flux-muted' },
  enviado:   { label: 'Enviado',   color: 'text-blue-400 bg-blue-950'     },
  aceptado:  { label: 'Aceptado',  color: 'text-flux-teal bg-flux-tealGlow' },
  rechazado: { label: 'Rechazado', color: 'text-red-400 bg-red-950'       },
  vencido:   { label: 'Vencido',   color: 'text-amber-400 bg-amber-950'   },
}

export const TARIFAS_DEFAULT = [
  { perfil: 'Consultoría estratégica',   valorHoraARS: 15000 },
  { perfil: 'Desarrollo / Programación', valorHoraARS: 12000 },
  { perfil: 'Automatización (n8n)',       valorHoraARS: 10000 },
  { perfil: 'Diseño UX/UI',              valorHoraARS:  9000 },
  { perfil: 'Soporte técnico',           valorHoraARS:  6000 },
  { perfil: 'Capacitación',              valorHoraARS:  8000 },
  { perfil: 'Gestión de proyecto',       valorHoraARS: 10000 },
  { perfil: 'Integración de sistemas',   valorHoraARS: 11000 },
]

export const CONDICIONES_DEFAULT = `• Forma de pago: 50% adelanto — 50% a la entrega
• Validez: ${30} días corridos desde la fecha de emisión
• Modificaciones fuera del alcance se presupuestan por separado
• Los plazos se acuerdan luego de aprobado el presupuesto`
