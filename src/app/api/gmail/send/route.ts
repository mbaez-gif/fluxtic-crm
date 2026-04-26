export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

function encodeEmail(to: string, from: string, subject: string, body: string) {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    body,
  ].join('\n')
  return Buffer.from(message).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function POST(req: NextRequest) {
  try {
    const {
      // Tokens passed directly from client — no server-side Firestore read needed
      access_token, refresh_token, expiry_date,
      to, subject, body,
    } = await req.json()

    if (!access_token || !to || !subject || !body) {
      return NextResponse.json({
        error: 'Faltan campos requeridos: access_token, to, subject, body'
      }, { status: 400 })
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    oauth2.setCredentials({ access_token, refresh_token, expiry_date })

    const gmail = google.gmail({ version: 'v1', auth: oauth2 })

    const profile   = await gmail.users.getProfile({ userId: 'me' })
    const fromEmail = profile.data.emailAddress ?? ''
    const raw       = encodeEmail(to, fromEmail, subject, body)

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    if (process.env.SLACK_WEBHOOK_URL) {
      fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `📧 Email enviado a ${to} — ${subject}` }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, messageId: res.data.id })
  } catch (err: unknown) {
    console.error('Gmail send error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    const friendly = msg.includes('insufficient') || msg.includes('permission')
      ? 'Permisos insuficientes. Reconectá Google en Integraciones y aceptá todos los permisos.'
      : msg.includes('invalid_grant')
      ? 'Token expirado. Ve a Integraciones → Reconectar Google.'
      : msg
    return NextResponse.json({ success: false, error: friendly }, { status: 500 })
  }
}
