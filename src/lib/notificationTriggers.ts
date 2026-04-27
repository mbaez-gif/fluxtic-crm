// ── useNotifications ─────────────────────────────────────
// Import and call these functions wherever events happen in the CRM
// Example: after createDoc('leads', ...) call notifyNewLead(lead)

import { notifyAllSocios, createNotification } from '@/lib/firebase/notifications'
import type { Lead, Oportunidad } from '@/types'
import { SOCIOS } from '@/types/admin'

// ── Lead events ───────────────────────────────────────────
export async function notifyNewLead(lead: { nombre: string; empresa: string; fuente: string }) {
  await notifyAllSocios(
    'nuevo_lead',
    `${lead.nombre} — ${lead.empresa} (${lead.fuente})`,
    { href: '/leads' }
  )
}

export async function notifyLeadCalificado(lead: { nombre: string; empresa: string }) {
  await notifyAllSocios(
    'lead_calificado',
    `${lead.nombre} de ${lead.empresa} fue calificado`,
    { href: '/leads' }
  )
}

// ── Oportunidad events ────────────────────────────────────
export async function notifyNewOportunidad(op: { titulo: string; valorEstimado: number }) {
  await notifyAllSocios(
    'nueva_oportunidad',
    `${op.titulo} — $${op.valorEstimado.toLocaleString('es-AR')}`,
    { href: '/oportunidades' }
  )
}

export async function notifyOportunidadGanada(op: { titulo: string; valorEstimado: number }) {
  await notifyAllSocios(
    'oportunidad_ganada',
    `🏆 ${op.titulo} — $${op.valorEstimado.toLocaleString('es-AR')}`,
    { href: '/oportunidades' }
  )
}

export async function notifyOportunidadPerdida(op: { titulo: string }) {
  await notifyAllSocios(
    'oportunidad_perdida',
    `${op.titulo}`,
    { href: '/oportunidades' }
  )
}

// ── Propuesta events ──────────────────────────────────────
export async function notifyPropuestaAceptada(p: { titulo: string; clienteNombre: string }) {
  await notifyAllSocios(
    'propuesta_aceptada',
    `${p.titulo} — ${p.clienteNombre}`,
    { href: '/propuestas' }
  )
}

// ── WhatsApp events ───────────────────────────────────────
export async function notifyNuevaConversacionWA(contacto: string, numero: string) {
  await notifyAllSocios(
    'nueva_conversacion_wa',
    `${contacto} (${numero}) inició una conversación`,
    { href: '/whatsapp' }
  )
}

export async function notifyMensajeWA(contacto: string, preview: string) {
  await notifyAllSocios(
    'mensaje_wa',
    `${contacto}: "${preview.slice(0, 60)}${preview.length > 60 ? '…' : ''}"`,
    { href: '/whatsapp' }
  )
}

// ── Abono events ──────────────────────────────────────────
export async function notifyVencimientoAbono(abono: { nombre: string; dias: number }) {
  await notifyAllSocios(
    'vencimiento_abono',
    `${abono.nombre} vence en ${abono.dias} día${abono.dias !== 1 ? 's' : ''}`,
    { href: '/abonos' }
  )
}

// ── Tarea events ──────────────────────────────────────────
export async function notifyTareaVencida(tarea: { titulo: string }, uid: string) {
  await createNotification(
    'tarea_vencida',
    `"${tarea.titulo}" venció hoy`,
    uid,
    { href: '/tareas' }
  )
}

// ── Cliente events ────────────────────────────────────────
export async function notifyNuevoCliente(cliente: { nombre: string; empresa: string }) {
  await notifyAllSocios(
    'nuevo_cliente',
    `${cliente.nombre} — ${cliente.empresa}`,
    { href: '/clientes' }
  )
}
