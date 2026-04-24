import { google }              from 'googleapis'
import { getAuthenticatedClient } from './oauth'
import { createDoc }           from '@/lib/firebase/firestore'
import type { EmailLog }       from '@/types/integrations'

// ── Encode email as RFC 2822 base64 ──────────────────────
function encodeEmail({
  to, from, subject, body,
}: { to: string; from: string; subject: string; body: string }) {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    body,
  ].join('\n')

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ── Send email via Gmail API ──────────────────────────────
export async function sendEmail({
  uid,
  to,
  subject,
  body,
  leadId,
  clienteId,
  oportunidadId,
  propuestaId,
  plantillaId,
}: {
  uid:           string
  to:            string
  subject:       string
  body:          string
  leadId?:       string
  clienteId?:    string
  oportunidadId?: string
  propuestaId?:  string
  plantillaId?:  string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const auth  = await getAuthenticatedClient(uid)
    const gmail = google.gmail({ version: 'v1', auth })

    // Get sender email
    const profile  = await gmail.users.getProfile({ userId: 'me' })
    const fromEmail = profile.data.emailAddress ?? ''

    const raw = encodeEmail({ to, from: fromEmail, subject, body })

    const res = await gmail.users.messages.send({
      userId:      'me',
      requestBody: { raw },
    })

    const messageId = res.data.id ?? undefined

    // Log to Firestore
    await createDoc<EmailLog>('emailLog', {
      destinatario:   to,
      asunto:         subject,
      cuerpo:         body,
      estado:         'enviado',
      gmailMessageId: messageId,
      ...(leadId        && { leadId }),
      ...(clienteId     && { clienteId }),
      ...(oportunidadId && { oportunidadId }),
      ...(propuestaId   && { propuestaId }),
      ...(plantillaId   && { plantillaId }),
    })

    return { success: true, messageId }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : 'Error desconocido'

    // Log failed attempt
    await createDoc<EmailLog>('emailLog', {
      destinatario: to,
      asunto:       subject,
      cuerpo:       body,
      estado:       'error',
      ...(leadId    && { leadId }),
      ...(clienteId && { clienteId }),
    })

    return { success: false, error }
  }
}

// ── Email templates ───────────────────────────────────────
export const EMAIL_TEMPLATES = {
  seguimiento_lead: (nombre: string, responsable: string) => ({
    subject: `Hola ${nombre}, seguimiento de tu consulta`,
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background: #0D0F14; padding: 24px; border-radius: 8px 8px 0 0;">
    <img src="https://fluxtic-crm.vercel.app/logo.png" alt="Fluxtic" style="height: 32px;" />
  </div>
  <div style="padding: 32px; background: #fff; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="margin: 0 0 16px; color: #111;">Hola, ${nombre} 👋</h2>
    <p style="line-height: 1.6; color: #555;">
      Queríamos hacer un seguimiento de tu consulta con Fluxtic.
      Estamos aquí para ayudarte a dar el siguiente paso.
    </p>
    <p style="line-height: 1.6; color: #555;">
      ¿Tienes disponibilidad esta semana para una llamada de 30 minutos?
    </p>
    <a href="mailto:${responsable}"
      style="display: inline-block; margin-top: 16px; padding: 12px 24px;
             background: #00D4A8; color: #0D0F14; border-radius: 8px;
             text-decoration: none; font-weight: bold;">
      Responder
    </a>
  </div>
  <div style="padding: 16px; text-align: center; color: #999; font-size: 12px;">
    Fluxtic · Consultoría estratégica
  </div>
</div>`,
  }),

  propuesta_enviada: (nombre: string, empresa: string, monto: number) => ({
    subject: `Propuesta de consultoría para ${empresa}`,
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background: #0D0F14; padding: 24px; border-radius: 8px 8px 0 0;">
    <span style="color: #00D4A8; font-size: 20px; font-weight: bold;">Fluxtic</span>
  </div>
  <div style="padding: 32px; background: #fff; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="margin: 0 0 16px; color: #111;">Hola, ${nombre}</h2>
    <p style="line-height: 1.6; color: #555;">
      Adjuntamos la propuesta de consultoría preparada especialmente para <strong>${empresa}</strong>.
    </p>
    <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0; color: #111; font-size: 14px;">
        <strong>Inversión:</strong> €${monto.toLocaleString('es-ES')}
      </p>
    </div>
    <p style="line-height: 1.6; color: #555;">
      Quedamos a disposición para cualquier consulta o ajuste que necesites.
    </p>
  </div>
  <div style="padding: 16px; text-align: center; color: #999; font-size: 12px;">
    Fluxtic · Consultoría estratégica
  </div>
</div>`,
  }),

  bienvenida_cliente: (nombre: string, empresa: string) => ({
    subject: `¡Bienvenido a Fluxtic, ${empresa}! 🎉`,
    body: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background: #0D0F14; padding: 24px; border-radius: 8px 8px 0 0;">
    <span style="color: #00D4A8; font-size: 20px; font-weight: bold;">Fluxtic</span>
  </div>
  <div style="padding: 32px; background: #fff; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="margin: 0 0 16px; color: #111;">¡Bienvenido, ${nombre}! 🚀</h2>
    <p style="line-height: 1.6; color: #555;">
      Estamos muy contentos de tener a <strong>${empresa}</strong> como cliente de Fluxtic.
    </p>
    <p style="line-height: 1.6; color: #555;">
      En las próximas horas te contactaremos para agendar la reunión de kickoff
      y arrancar con el proyecto.
    </p>
  </div>
  <div style="padding: 16px; text-align: center; color: #999; font-size: 12px;">
    Fluxtic · Consultoría estratégica
  </div>
</div>`,
  }),
}
