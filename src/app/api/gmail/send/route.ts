import { type NextRequest, NextResponse } from 'next/server'
import { google }      from 'googleapis'
import { db }          from '@/lib/firebase/config'
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'

async function getOAuthClient(uid: string) {
  const snap = await getDoc(doc(db, 'googleTokens', uid))
  if (!snap.exists()) throw new Error('Google no conectado')

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2.setCredentials(snap.data())
  return oauth2
}

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

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function POST(req: NextRequest) {
  try {
    const { uid, to, subject, body, leadId, clienteId, oportunidadId } = await req.json()

    if (!uid || !to || !subject || !body) {
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    }

    const auth  = await getOAuthClient(uid)
    const gmail = google.gmail({ version: 'v1', auth })

    const profile  = await gmail.users.getProfile({ userId: 'me' })
    const fromEmail = profile.data.emailAddress ?? ''
    const raw = encodeEmail(to, fromEmail, subject, body)

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    })

    // Log to Firestore
    await addDoc(collection(db, 'emailLog'), {
      destinatario:   to,
      asunto:         subject,
      estado:         'enviado',
      gmailMessageId: res.data.id,
      ...(leadId        && { leadId }),
      ...(clienteId     && { clienteId }),
      ...(oportunidadId && { oportunidadId }),
      creadoEn:      serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    })

    // Slack notification (optional, fire and forget)
    if (process.env.SLACK_WEBHOOK_URL) {
      fetch(process.env.SLACK_WEBHOOK_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `📧 Email enviado a ${to} — ${subject}` }),
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, messageId: res.data.id })
  } catch (err: unknown) {
    console.error('Gmail send error:', err)
    const error = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
