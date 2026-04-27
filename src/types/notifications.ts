import type { Timestamp } from 'firebase/firestore'

export type NotificationType =
  | 'nuevo_lead'
  | 'lead_calificado'
  | 'nueva_conversacion_wa'
  | 'mensaje_wa'
  | 'nueva_oportunidad'
  | 'oportunidad_ganada'
  | 'oportunidad_perdida'
  | 'nueva_propuesta'
  | 'propuesta_aceptada'
  | 'vencimiento_abono'
  | 'tarea_vencida'
  | 'nuevo_cliente'
  | 'nuevo_gasto'
  | 'cierre_mensual'

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface Notification {
  id:           string
  tipo:         NotificationType
  titulo:       string
  descripcion:  string
  prioridad:    NotificationPriority
  leida:        boolean
  archivada:    boolean
  href?:        string          // link to navigate when clicked
  metadata?:    Record<string, string>  // extra data
  destinatarioUid: string       // who receives it
  creadoPorUid?:   string
  creadoEn:     Timestamp
}

// ── Config per type ───────────────────────────────────────
export const NOTIF_CONFIG: Record<NotificationType, {
  label:    string
  icon:     string
  color:    string
  priority: NotificationPriority
}> = {
  nuevo_lead:            { label: 'Nuevo lead',          icon: '👤', color: '#60A5FA', priority: 'high'   },
  lead_calificado:       { label: 'Lead calificado',     icon: '⭐', color: '#00D4A8', priority: 'medium' },
  nueva_conversacion_wa: { label: 'WhatsApp',            icon: '💬', color: '#22C55E', priority: 'high'   },
  mensaje_wa:            { label: 'Mensaje WhatsApp',    icon: '💬', color: '#22C55E', priority: 'medium' },
  nueva_oportunidad:     { label: 'Nueva oportunidad',   icon: '📈', color: '#A78BFA', priority: 'medium' },
  oportunidad_ganada:    { label: '¡Oportunidad ganada!',icon: '🏆', color: '#F59E0B', priority: 'urgent' },
  oportunidad_perdida:   { label: 'Oportunidad perdida', icon: '❌', color: '#F43F5E', priority: 'low'    },
  nueva_propuesta:       { label: 'Nueva propuesta',     icon: '📄', color: '#60A5FA', priority: 'medium' },
  propuesta_aceptada:    { label: '¡Propuesta aceptada!',icon: '✅', color: '#00D4A8', priority: 'urgent' },
  vencimiento_abono:     { label: 'Abono por vencer',    icon: '⏰', color: '#F59E0B', priority: 'high'   },
  tarea_vencida:         { label: 'Tarea vencida',       icon: '⚠️', color: '#F43F5E', priority: 'high'   },
  nuevo_cliente:         { label: 'Nuevo cliente',       icon: '🏢', color: '#00D4A8', priority: 'medium' },
  nuevo_gasto:           { label: 'Nuevo gasto',         icon: '💰', color: '#94A3B8', priority: 'low'    },
  cierre_mensual:        { label: 'Cierre mensual',      icon: '📊', color: '#A78BFA', priority: 'medium' },
}

// ── Helper to create notifications ───────────────────────
export function buildNotification(
  tipo:            NotificationType,
  descripcion:     string,
  destinatarioUid: string,
  opts?: {
    href?:     string
    metadata?: Record<string, string>
    creadoPorUid?: string
  }
): Omit<Notification, 'id' | 'creadoEn'> {
  const cfg = NOTIF_CONFIG[tipo]
  return {
    tipo,
    titulo:          cfg.label,
    descripcion,
    prioridad:       cfg.priority,
    leida:           false,
    archivada:       false,
    destinatarioUid,
    href:            opts?.href,
    metadata:        opts?.metadata,
    creadoPorUid:    opts?.creadoPorUid,
  }
}
