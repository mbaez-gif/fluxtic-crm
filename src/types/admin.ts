import type { Timestamp } from 'firebase/firestore'

// ── Socios ────────────────────────────────────────────────
export interface Socio {
  uid:    string
  nombre: string
  email:  string
  color:  string   // for UI differentiation
}

export const SOCIOS: Socio[] = [
  { uid: '1YqXa1MbfBP6VLGGmAaIy22PqDJ2', nombre: 'Martín',   email: 'mbaez@fluxtic.com',    color: '#00D4A8' },
  { uid: 'qP41h2M8uiRLyVLU0OWB1EfgmIE3',                   nombre: 'Facundo',  email: 'facundo@fluxtic.com',  color: '#60A5FA' },
  { uid: 'DQ9Hd7KriqYD04BSTGExppcyWzC3',                  nombre: 'Santiago', email: 'santiago@fluxtic.com', color: '#F59E0B' },
]

// ── Gasto — Estados ───────────────────────────────────────
export type GastoEstado =
  | 'draft'
  | 'pending_payment'
  | 'paid'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'to_reimburse'
  | 'reimbursed'
  | 'cancelled'

export type ApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'approved'
  | 'rejected'

export type GastoTipo =
  | 'operating'
  | 'fixed_monthly'
  | 'annual'
  | 'project'
  | 'client'
  | 'commercial'
  | 'marketing'
  | 'infrastructure'
  | 'reimbursable'
  | 'initial_investment'
  | 'other'

export type GastoFuente =
  | 'manual'
  | 'ai_document'
  | 'recurring'
  | 'import'
  | 'email_future'

export type Moneda = 'ARS' | 'USD' | 'EUR'

// Distribución de gasto entre socios
export interface DistribucionSocio {
  uid:        string
  nombre:     string
  porcentaje: number   // 0-100
  monto:      number
  moneda:     Moneda
  pagado:     boolean
}

// ── Gasto ─────────────────────────────────────────────────
export interface Gasto {
  id:                string

  // Qué y cuándo
  fecha:             Timestamp
  periodo:           string        // YYYY-MM
  descripcion:       string
  tipo:              GastoTipo
  fuente:            GastoFuente

  // Montos
  importe:           number
  moneda:            Moneda
  tipoCambio?:       number        // si moneda != ARS
  importeARS?:       number        // calculado

  // Proveedor y categoría
  proveedorId?:      string
  proveedorNombre:   string
  categoriaId?:      string
  categoriaNombre:   string

  // Quién
  cargadoPorUid:     string        // auto desde Auth
  cargadoPorNombre:  string
  cargadoPorEmail:   string
  pagadoPorUid:      string        // seleccionado manual
  pagadoPorNombre:   string

  // Medio de pago
  medioPagoId?:      string
  medioPagoNombre?:  string

  // Vinculaciones opcionales
  clienteId?:        string
  clienteNombre?:    string
  proyectoId?:       string
  proyectoNombre?:   string

  // Comprobante
  documentoId?:      string        // ref a expenseDocuments
  tieneComprobante:  boolean

  // Distribución entre socios
  distribuirEntreSocios: boolean
  distribucion?:         DistribucionSocio[]

  // Estados
  estado:            GastoEstado
  approvalStatus:    ApprovalStatus
  esReintegrable:    boolean
  reintegradoAt?:    Timestamp

  // Recurrente
  esRecurrente:      boolean
  recurrenteId?:     string

  // Cierre mensual
  incluidoEnCierre:  boolean
  cierreId?:         string
  informadoPorMail:  boolean

  // Metadata
  notas?:            string
  tags?:             string[]
  creadoEn:          Timestamp
  actualizadoEn:     Timestamp
  anuladoEn?:        Timestamp
  anuladoPorUid?:    string
}

// ── Proveedor ─────────────────────────────────────────────
export type ProveedorTipo =
  | 'software'
  | 'service'
  | 'supplier'
  | 'freelancer'
  | 'government'
  | 'bank'
  | 'other'

export interface Proveedor {
  id:                   string
  nombre:               string
  nombreNormalizado:    string   // lowercase sin tildes para búsqueda
  tipo:                 ProveedorTipo
  taxId?:               string   // CUIT
  website?:             string
  contactEmail?:        string
  telefono?:            string
  categoriaPorDefectoId?:     string
  categoriaPorDefectoNombre?: string
  tipoPorDefecto?:      GastoTipo
  monedaPorDefecto?:    Moneda
  activo:               boolean
  notas?:               string
  creadoEn:             Timestamp
  actualizadoEn:        Timestamp
}

// ── Categoría ─────────────────────────────────────────────
export interface Categoria {
  id:           string
  nombre:       string
  parentId?:    string
  activo:       boolean
  sortOrder:    number
  color?:       string
  icono?:       string
  creadoEn:     Timestamp
  actualizadoEn: Timestamp
}

export const CATEGORIAS_INICIALES = [
  { nombre: 'Software y suscripciones',  sortOrder: 1,  color: '#60A5FA' },
  { nombre: 'Google Workspace',          sortOrder: 2,  color: '#00D4A8' },
  { nombre: 'IA y automatización',       sortOrder: 3,  color: '#A78BFA' },
  { nombre: 'Infraestructura y hosting', sortOrder: 4,  color: '#34D399' },
  { nombre: 'Dominio y DNS',             sortOrder: 5,  color: '#6EE7B7' },
  { nombre: 'Marketing y publicidad',    sortOrder: 6,  color: '#F59E0B' },
  { nombre: 'Diseño gráfico y branding', sortOrder: 7,  color: '#F472B6' },
  { nombre: 'Herramientas comerciales',  sortOrder: 8,  color: '#FB923C' },
  { nombre: 'Comisiones bancarias',      sortOrder: 9,  color: '#94A3B8' },
  { nombre: 'Impuestos y tasas',         sortOrder: 10, color: '#F87171' },
  { nombre: 'Servicios profesionales',   sortOrder: 11, color: '#38BDF8' },
  { nombre: 'Movilidad y reuniones',     sortOrder: 12, color: '#4ADE80' },
  { nombre: 'Equipamiento',             sortOrder: 13, color: '#FBBF24' },
  { nombre: 'Gastos de clientes',        sortOrder: 14, color: '#E879F9' },
  { nombre: 'Gastos de proyectos',       sortOrder: 15, color: '#22D3EE' },
  { nombre: 'Otros',                     sortOrder: 16, color: '#9CA3AF' },
]

// ── Medio de pago ─────────────────────────────────────────
export type MedioPagoTipo =
  | 'cash'
  | 'debit_card'
  | 'credit_card'
  | 'bank_transfer'
  | 'digital_wallet'
  | 'crypto'
  | 'check'
  | 'other'

export interface MedioPago {
  id:           string
  nombre:       string
  tipo:         MedioPagoTipo
  ownerUid:     string    // socio dueño de este medio
  ownerNombre:  string
  institucion?: string
  ultimos4?:    string
  moneda:       Moneda
  activo:       boolean
  notas?:       string
  creadoEn:     Timestamp
  actualizadoEn: Timestamp
}

// ── Documento (comprobante) ───────────────────────────────
export type DocumentoEstado =
  | 'uploaded'
  | 'processing'
  | 'interpreted'
  | 'requires_review'
  | 'confirmed'
  | 'error'
  | 'discarded'

export interface ExpenseDocument {
  id:              string
  gastoId?:        string          // set after confirmation
  fileName:        string
  fileType:        string
  fileSize:        number
  storageUrl:      string          // Firebase Storage URL
  storagePath:     string
  processingStatus: DocumentoEstado
  aiInterpretation?: AIInterpretation
  cargadoPorUid:   string
  cargadoPorNombre: string
  creadoEn:        Timestamp
  actualizadoEn:   Timestamp
  errorMsg?:       string
}

export interface AIInterpretation {
  vendorName?:              string
  vendorTaxId?:             string
  documentDate?:            string
  dueDate?:                 string
  documentType?:            string
  documentNumber?:          string
  pointOfSale?:             string
  fullDocumentNumber?:      string
  description?:             string
  subtotal?:                number
  taxes?:                   number
  otherTaxes?:              number
  totalAmount?:             number
  currency?:                string
  paymentMethodDetected?:   string
  cbuDetected?:             string
  aliasDetected?:           string
  cae?:                     string
  caeDueDate?:              string
  taxCondition?:            string
  suggestedCategoryName?:   string
  suggestedExpenseType?:    string
  suggestedPeriod?:         string
  suggestedIsRecurring?:    boolean
  confidence:               Record<string, number>
  requiresReview:           boolean
  reviewReasons:            string[]
}

// ── Gasto Recurrente ──────────────────────────────────────
export type RecurrenciaFrecuencia = 'monthly' | 'quarterly' | 'annual'

export interface GastoRecurrente {
  id:              string
  nombre:          string
  proveedorId?:    string
  proveedorNombre: string
  categoriaId?:    string
  categoriaNombre: string
  tipo:            GastoTipo
  importe:         number
  moneda:          Moneda
  frecuencia:      RecurrenciaFrecuencia
  diaDelMes:       number    // 1-28
  medioPagoId?:    string
  pagadoPorUid:    string
  pagadoPorNombre: string
  distribuirEntreSocios: boolean
  distribucion?:   DistribucionSocio[]
  activo:          boolean
  proximaFecha:    Timestamp
  ultimaFecha?:    Timestamp
  notas?:          string
  creadoEn:        Timestamp
  actualizadoEn:   Timestamp
}

// ── Cierre Mensual ────────────────────────────────────────
export type CierreEstado = 'draft' | 'closed' | 'reopened'

export interface SaldoSocio {
  uid:         string
  nombre:      string
  totalPagado: number    // lo que puso de su bolsillo
  totalCorresponde: number  // lo que le corresponde asumir
  saldo:       number    // positivo = le deben, negativo = debe
}

export interface CompensacionPago {
  deUid:    string
  deNombre: string
  aUid:     string
  aNombre:  string
  monto:    number
  moneda:   Moneda
}

export interface CierreMensual {
  id:               string
  periodo:          string      // YYYY-MM
  estado:           CierreEstado
  totalGastosARS:   number
  totalGastosUSD:   number
  cantidadGastos:   number
  saldosPorSocio:   SaldoSocio[]
  compensaciones:   CompensacionPago[]  // quién le paga a quién y cuánto
  gastoIds:         string[]
  cerradoPorUid?:   string
  cerradoEn?:       Timestamp
  reporteEnviadoEn?: Timestamp
  notas?:           string
  creadoEn:         Timestamp
  actualizadoEn:    Timestamp
}

// ── Auditoría ─────────────────────────────────────────────
export type AuditAccion =
  | 'created' | 'updated' | 'deleted' | 'approved'
  | 'rejected' | 'cancelled' | 'closed' | 'reopened'
  | 'document_uploaded' | 'document_confirmed' | 'report_sent'

export interface AuditLog {
  id:           string
  entidadTipo:  string   // 'gasto' | 'proveedor' | 'cierre' | etc.
  entidadId:    string
  accion:       AuditAccion
  usuarioUid:   string
  usuarioNombre: string
  cambios?:     Record<string, { antes: unknown; despues: unknown }>
  notas?:       string
  creadoEn:     Timestamp
}

// ── Labels UI ─────────────────────────────────────────────
export const GASTO_ESTADO_LABEL: Record<GastoEstado, string> = {
  draft:            'Borrador',
  pending_payment:  'Pend. pago',
  paid:             'Pagado',
  pending_approval: 'Pend. aprobación',
  approved:         'Aprobado',
  rejected:         'Rechazado',
  to_reimburse:     'A reintegrar',
  reimbursed:       'Reintegrado',
  cancelled:        'Anulado',
}

export const GASTO_TIPO_LABEL: Record<GastoTipo, string> = {
  operating:         'Operativo',
  fixed_monthly:     'Fijo mensual',
  annual:            'Anual',
  project:           'De proyecto',
  client:            'De cliente',
  commercial:        'Comercial',
  marketing:         'Marketing',
  infrastructure:    'Infraestructura',
  reimbursable:      'Reembolsable',
  initial_investment: 'Inversión inicial',
  other:             'Otro',
}

export const MEDIO_PAGO_TIPO_LABEL: Record<MedioPagoTipo, string> = {
  cash:            'Efectivo',
  debit_card:      'Débito',
  credit_card:     'Crédito',
  bank_transfer:   'Transferencia',
  digital_wallet:  'Billetera digital',
  crypto:          'Cripto',
  check:           'Cheque',
  other:           'Otro',
}

export const MONEDA_SYMBOL: Record<Moneda, string> = {
  ARS: '$',
  USD: 'USD $',
  EUR: '€',
}
