import type { Timestamp } from 'firebase/firestore'

// ── Email Log ─────────────────────────────────────────────
export type EmailEstado = 'enviado' | 'error' | 'rebotado'

export interface EmailLog {
  id:              string
  destinatario:    string
  asunto:          string
  cuerpo:          string
  estado:          EmailEstado
  leadId?:         string
  clienteId?:      string
  oportunidadId?:  string
  propuestaId?:    string
  plantillaId?:    string
  gmailMessageId?: string
  creadoEn:        Timestamp
  actualizadoEn:   Timestamp
}

// ── Calendar Events ───────────────────────────────────────
export type CalendarVinculadoTipo = 'lead' | 'oportunidad' | 'cliente' | 'proyecto'

export interface CalendarEvent {
  id:              string
  googleEventId:   string
  titulo:          string
  descripcion?:    string
  fechaInicio:     Timestamp
  fechaFin:        Timestamp
  vinculadoTipo:   CalendarVinculadoTipo
  vinculadoId:     string
  responsableId:   string
  attendees:       string[]   // emails
  meetLink?:       string
  creadoEn:        Timestamp
  actualizadoEn:   Timestamp
}

// ── Notification Templates ────────────────────────────────
export type PlantillaCanal = 'email' | 'slack' | 'whatsapp'

export interface NotificationTemplate {
  id:        string
  nombre:    string
  canal:     PlantillaCanal
  asunto?:   string           // solo email
  cuerpo:    string
  variables: string[]         // ej: ['nombre', 'empresa', 'responsable']
  creadoEn:  Timestamp
  actualizadoEn: Timestamp
}

// ── Webhook Events (log de entradas externas) ─────────────
export type WebhookFuente = 'formulario_web' | 'n8n' | 'slack' | 'meta' | 'wati'

export interface WebhookEvent {
  id:         string
  fuente:     WebhookFuente
  tipo:       string
  payload:    Record<string, unknown>
  procesado:  boolean
  error?:     string
  creadoEn:   Timestamp
}

// ── Activity Log ──────────────────────────────────────────
export type ActividadTipo =
  | 'lead_creado' | 'lead_actualizado'
  | 'oportunidad_ganada' | 'oportunidad_perdida'
  | 'propuesta_enviada' | 'propuesta_aceptada'
  | 'cliente_creado'
  | 'proyecto_creado' | 'proyecto_completado'
  | 'abono_creado' | 'pago_registrado'
  | 'email_enviado'
  | 'evento_creado'
  | 'tarea_completada'

export interface ActivityLog {
  id:           string
  usuarioId:    string
  tipo:         ActividadTipo
  entidadTipo:  string
  entidadId:    string
  descripcion:  string
  creadoEn:     Timestamp
}
