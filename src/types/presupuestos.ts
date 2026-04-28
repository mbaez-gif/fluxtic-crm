import type { Timestamp } from 'firebase/firestore'

export type PresupuestoEstado =
  | 'borrador' | 'enviado' | 'aprobado' | 'rechazado' | 'vencido'

// ── ESTADO_CONFIG — badge visual per state ────────────────
export const ESTADO_CONFIG: Record<PresupuestoEstado, {
  label: string; color: string; bg: string
}> = {
  borrador:  { label: 'Borrador',  color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
  enviado:   { label: 'Enviado',   color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  aprobado:  { label: 'Aprobado',  color: '#00D4A8', bg: 'rgba(0,212,168,0.12)'   },
  rechazado: { label: 'Rechazado', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  vencido:   { label: 'Vencido',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
}

export const TIPOS_SERVICIO = [
  'Automatización de procesos', 'CRM', 'Integraciones',
  'Inteligencia Artificial', 'WhatsApp Business',
  'Instagram / Redes sociales', 'Google Workspace',
  'Microsoft 365', 'n8n', 'Dashboards', 'Infraestructura',
  'Consultoría tecnológica', 'Desarrollo web',
  'Landing page', 'Soporte mensual', 'Otro',
]

export const ITEM_CATEGORIAS = [
  'Implementación', 'Desarrollo', 'Automatización', 'Integración',
  'Licencias', 'Soporte', 'Mantenimiento', 'Capacitación',
  'Infraestructura', 'Consultoría', 'Diseño', 'Otro',
]

export type ItemTipo = 'unico' | 'mensual' | 'anual' | 'opcional'

export const ITEM_TIPO_LABEL: Record<ItemTipo, string> = {
  unico: 'Único', mensual: 'Mensual', anual: 'Anual', opcional: 'Opcional',
}

export interface PresupuestoItem {
  id:          string
  descripcion: string
  categoria:   string
  cantidad:    number
  unidad:      string
  precioUnit:  number
  descuento:   number
  subtotal:    number
  tipo:        ItemTipo
  incluido:    boolean
}

export interface Etapa {
  id:          string
  nombre:      string
  descripcion: string
  duracion:    string
}

export const ETAPAS_DEFAULT: Etapa[] = [
  { id: '1', nombre: 'Relevamiento',            descripcion: 'Análisis del proceso actual y relevamiento de requerimientos.', duracion: '1 semana'   },
  { id: '2', nombre: 'Diseño funcional',         descripcion: 'Diseño del flujo, arquitectura y especificación técnica.',      duracion: '1 semana'   },
  { id: '3', nombre: 'Configuración/Desarrollo', descripcion: 'Implementación de la solución acordada.',                        duracion: '2-3 semanas' },
  { id: '4', nombre: 'Pruebas',                  descripcion: 'Testeo funcional con el equipo del cliente.',                   duracion: '1 semana'   },
  { id: '5', nombre: 'Ajustes',                  descripcion: 'Correcciones y ajustes post-testing.',                          duracion: '3-5 días'   },
  { id: '6', nombre: 'Puesta en marcha',         descripcion: 'Go-live y configuración del entorno productivo.',               duracion: '1-2 días'   },
  { id: '7', nombre: 'Acompañamiento inicial',   descripcion: 'Soporte post-implementación y capacitación del equipo.',        duracion: '2 semanas'  },
]

export interface ClientePresupuesto {
  clienteId?:    string
  razonSocial:   string
  contacto:      string
  cuitDni:       string
  email:         string
  telefono:      string
  direccion:     string
  localidad:     string
  provincia:     string
  rubro:         string
  observaciones: string
}

export interface Presupuesto {
  id:               string
  budgetNumber:     string
  estado:           PresupuestoEstado
  clienteData:      ClientePresupuesto
  titulo:           string
  tipoServicio:     string
  fechaEmision:     string
  fechaVencimiento: string
  validezDias:      number
  responsable:      string
  emailContacto:    string
  resumenEjecutivo: string
  objetivo:         string
  contexto:         string
  alcanceGeneral:   string
  alcanceTecnico:   string
  entregables:      string
  fueraAlcance:     string
  requisitos:       string
  supuestos:        string
  etapas:           Etapa[]
  items:            PresupuestoItem[]
  moneda:           'ARS' | 'USD'
  incluyeIVA:       boolean
  tasaIVA:          number
  subtotal:         number
  descuentoTotal:   number
  ivaTotal:         number
  total:            number
  totalUnico:       number
  totalMensual:     number
  totalAnual:       number
  formaPago:        string
  condicionesComerciales: string
  notasInternas:    string
  creadoPorUid:     string
  creadoPorNombre:  string
  creadoEn:         Timestamp
  actualizadoEn:    Timestamp
  enviadoEn?:       Timestamp
  aprobadoEn?:      Timestamp
  rechazadoEn?:     Timestamp
}

export const DATOS_FLUXTIC = {
  empresa: 'Fluxtic',
  email:   'contacto@fluxtic.com',
  sitio:   'fluxtic.com',
  tipo:    'Soluciones tecnológicas, automatización, IA e integraciones digitales',
}

export const CONDICIONES_DEFAULT = `• Validez de la oferta: según los días indicados desde la fecha de emisión.
• Forma de pago: 50% al inicio del proyecto — 50% a la entrega.
• Modificaciones fuera del alcance acordado se presupuestan por separado.
• Los plazos se acuerdan luego de aprobado el presupuesto.
• Licencias de herramientas de terceros no están incluidas salvo aclaración.
• Los precios no incluyen IVA salvo que se indique lo contrario.`

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

// ── formatMoney — moneda default ARS ─────────────────────
export function formatMoney(n: number, moneda: 'ARS' | 'USD' = 'ARS'): string {
  if (moneda === 'USD') {
    return `USD ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function calcularItem(item: PresupuestoItem): PresupuestoItem {
  const bruto    = item.cantidad * item.precioUnit
  const desc     = bruto * (item.descuento / 100)
  return { ...item, subtotal: bruto - desc }
}

export function calcularTotales(
  items:     PresupuestoItem[],
  tasaIVA:   number,
  incluyeIVA: boolean
) {
  const activos       = items.filter(i => i.tipo !== 'opcional' || i.incluido)
  const subtotal      = activos.reduce((a, i) => a + i.subtotal, 0)
  const descuentoTotal = activos.reduce((a, i) => a + (i.cantidad * i.precioUnit * i.descuento / 100), 0)
  const ivaTotal      = incluyeIVA ? 0 : subtotal * (tasaIVA / 100)
  const total         = subtotal + ivaTotal
  const totalUnico    = activos.filter(i => i.tipo === 'unico').reduce((a, i) => a + i.subtotal, 0)
  const totalMensual  = activos.filter(i => i.tipo === 'mensual').reduce((a, i) => a + i.subtotal, 0)
  const totalAnual    = activos.filter(i => i.tipo === 'anual').reduce((a, i) => a + i.subtotal, 0)
  return { subtotal, descuentoTotal, ivaTotal, total, totalUnico, totalMensual, totalAnual }
}

export function buildBudgetNumber(count: number): string {
  return `FLX-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`
}
