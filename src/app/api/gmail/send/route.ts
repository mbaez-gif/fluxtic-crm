import { type NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/google/gmail'
import { notifyEmailEnviado } from '@/lib/slack'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      uid, to, subject, body: emailBody,
      leadId, clienteId, oportunidadId, propuestaId, plantillaId,
    } = body

    if (!uid || !to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Faltan campos obligatorios: uid, to, subject, body' },
        { status: 400 }
      )
    }

    const result = await sendEmail({
      uid, to, subject, body: emailBody,
      leadId, clienteId, oportunidadId, propuestaId, plantillaId,
    })

    if (result.success) {
      // Notify Slack async (no await to not block response)
      notifyEmailEnviado(to, subject).catch(console.error)
      return NextResponse.json({ success: true, messageId: result.messageId })
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }
  } catch (err) {
    console.error('Gmail API error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
