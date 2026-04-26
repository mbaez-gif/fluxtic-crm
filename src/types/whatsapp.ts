import type { Timestamp } from 'firebase/firestore'

// ── WhatsApp Message ──────────────────────────────────────
export type WAMessageType    = 'text' | 'image' | 'document' | 'audio' | 'template'
export type WAMessageStatus  = 'sent' | 'delivered' | 'read' | 'failed' | 'received'
export type WAConversationStatus = 'open' | 'resolved' | 'waiting'

export interface WAMessage {
  id:             string
  conversationId: string
  waMessageId:    string       // ID de Meta
  direction:      'inbound' | 'outbound'
  type:           WAMessageType
  body:           string
  status:         WAMessageStatus
  mediaUrl?:      string
  templateName?:  string
  fromNumber:     string
  toNumber:       string
  creadoEn:       Timestamp
}

export interface WAConversation {
  id:             string
  leadId?:        string
  clienteId?:     string
  contactNombre:  string
  contactNumber:  string    // formato internacional sin +
  lastMessage:    string
  lastMessageAt:  Timestamp
  status:         WAConversationStatus
  unreadCount:    number
  assignedUid?:   string
  assignedNombre?: string
  creadoEn:       Timestamp
  actualizadoEn:  Timestamp
}

// ── WhatsApp Template ─────────────────────────────────────
export interface WATemplate {
  id:       string
  name:     string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string
  body:     string
  variables: string[]  // nombres de los placeholders
}

// Templates predefinidos para Fluxtic
export const WA_TEMPLATES: WATemplate[] = [
  {
    id:       'bienvenida',
    name:     'Bienvenida',
    category: 'UTILITY',
    language: 'es_AR',
    body:     'Hola {{nombre}}, 👋 somos Fluxtic, consultora tecnológica. Nos pusimos en contacto porque creemos que podemos ayudarte con la digitalización de {{empresa}}. ¿Tenés unos minutos para conversar?',
    variables: ['nombre', 'empresa'],
  },
  {
    id:       'seguimiento',
    name:     'Seguimiento',
    category: 'UTILITY',
    language: 'es_AR',
    body:     'Hola {{nombre}}, te escribimos desde Fluxtic para hacer seguimiento de nuestra conversación anterior. ¿Pudiste revisar la propuesta que te enviamos? Quedamos a tu disposición.',
    variables: ['nombre'],
  },
  {
    id:       'propuesta_lista',
    name:     'Propuesta lista',
    category: 'UTILITY',
    language: 'es_AR',
    body:     'Hola {{nombre}} 📄 Ya tenemos lista tu propuesta comercial. La enviamos por email a {{email}}. ¿La pudiste ver? Cualquier consulta, avisanos.',
    variables: ['nombre', 'email'],
  },
  {
    id:       'reunion_confirmada',
    name:     'Reunión confirmada',
    category: 'UTILITY',
    language: 'es_AR',
    body:     'Hola {{nombre}} ✅ Confirmamos tu reunión con Fluxtic para el {{fecha}} a las {{hora}}. Te esperamos. Cualquier inconveniente, avisanos con anticipación.',
    variables: ['nombre', 'fecha', 'hora'],
  },
]

// ── Google Drive ──────────────────────────────────────────
export interface DriveFolder {
  id:         string
  name:       string
  webViewLink: string
  createdAt:  string
}

export interface DriveFile {
  id:           string
  name:         string
  mimeType:     string
  size?:        string
  webViewLink:  string
  thumbnailLink?: string
  createdTime:  string
}
