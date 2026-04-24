import type { Timestamp } from 'firebase/firestore'

// ── Shared ────────────────────────────────────────────────
export type Role = 'admin' | 'consultor'

export interface FluxticUser {
  uid:       string
  email:     string
  nombre:    string
  rol:       Role
  avatarUrl: string | null
  creadoEn:  Date | Timestamp
}

// ── Leads ─────────────────────────────────────────────────
export type LeadFuente  = 'referido' | 'web' | 'evento' | 'outbound' | 'otro'
export type LeadEstado  = 'nuevo' | 'contactado' | 'calificado' | 'descartado'

export interface Lead {
  id:            string
  nombre:        string
  empresa:       string
  email:         string
  telefono?:     string
  fuente:        LeadFuente
  estado:        LeadEstado
  responsableId: string
  notas?:        string
  creadoEn:      Timestamp
  actualizadoEn: Timestamp
}

// ── Diagnósticos ──────────────────────────────────────────
export type DiagnosticoEstado = 'borrador' | 'en_revision' | 'completado'

export interface Diagnostico {
  id:               string
  leadId:           string
  titulo:           string
  hallazgos:        string
  recomendaciones:  string
  estado:           DiagnosticoEstado
  responsableId:    string
  creadoEn:         Timestamp
  actualizadoEn:    Timestamp
}

// ── Oportunidades ─────────────────────────────────────────
export type OportunidadEtapa =
  | 'analisis'
  | 'propuesta'
  | 'negociacion'
  | 'ganada'
  | 'perdida'

export interface Oportunidad {
  id:               string
  leadId:           string
  diagnosticoId?:   string
  titulo:           string
  valorEstimado:    number
  probabilidad:     number
  etapa:            OportunidadEtapa
  cierreEstimado:   Timestamp
  responsableId:    string
  notas?:           string
  creadoEn:         Timestamp
  actualizadoEn:    Timestamp
}

// ── Propuestas ────────────────────────────────────────────
export type PropuestaEstado = 'borrador' | 'enviada' | 'aceptada' | 'rechazada'

export interface Propuesta {
  id:            string
  oportunidadId: string
  titulo:        string
  alcance:       string
  entregables:   string[]
  monto:         number
  moneda:        string
  condiciones:   string
  estado:        PropuestaEstado
  version:       number
  creadoEn:      Timestamp
  actualizadoEn: Timestamp
}

// ── Clientes ──────────────────────────────────────────────
export type ClienteEstado = 'activo' | 'inactivo' | 'churned'

export interface ContactoCliente {
  nombre:    string
  email:     string
  cargo?:    string
  telefono?: string
}

export interface Cliente {
  id:            string
  oportunidadId: string
  nombre:        string
  empresa:       string
  email:         string
  sector?:       string
  contactos:     ContactoCliente[]
  estado:        ClienteEstado
  creadoEn:      Timestamp
  actualizadoEn: Timestamp
}

// ── Proyectos ─────────────────────────────────────────────
export type ProyectoEstado = 'activo' | 'pausado' | 'completado' | 'cancelado'

export interface Proyecto {
  id:            string
  clienteId:     string
  propuestaId?:  string
  nombre:        string
  descripcion:   string
  presupuesto:   number
  fechaInicio:   Timestamp
  fechaFin?:     Timestamp
  estado:        ProyectoEstado
  responsableId: string
  creadoEn:      Timestamp
  actualizadoEn: Timestamp
}

// ── Abonos ────────────────────────────────────────────────
export type AbonoPeriodicidad = 'mensual' | 'trimestral' | 'anual'
export type AbonoEstado       = 'activo' | 'pausado' | 'cancelado'
export type PagoEstado        = 'pendiente' | 'pagado' | 'vencido'

export interface Pago {
  id:           string
  abonoId:      string
  monto:        number
  fechaEmitido: Timestamp
  fechaPagado?: Timestamp
  estado:       PagoEstado
}

export interface Abono {
  id:              string
  clienteId:       string
  nombre:          string
  descripcion:     string
  monto:           number
  moneda:          string   // ← ARS | USD | EUR
  periodicidad:    AbonoPeriodicidad
  fechaInicio:     Timestamp
  fechaRenovacion: Timestamp
  estado:          AbonoEstado
  creadoEn:        Timestamp
  actualizadoEn:   Timestamp
}

// ── Tareas ────────────────────────────────────────────────
export type TareaEstado    = 'pendiente' | 'en_progreso' | 'revision' | 'completada'
export type TareaPrioridad = 'baja' | 'media' | 'alta' | 'urgente'

export interface Tarea {
  id:            string
  proyectoId?:   string
  titulo:        string
  descripcion?:  string
  responsableId: string
  estado:        TareaEstado
  prioridad:     TareaPrioridad
  fechaLimite?:  Timestamp
  etiquetas:     string[]
  creadoEn:      Timestamp
  actualizadoEn: Timestamp
}
