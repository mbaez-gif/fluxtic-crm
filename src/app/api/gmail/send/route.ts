import { type NextRequest, NextResponse } from 'next/server'
import { google }      from 'googleapis'
import { db }          from '@/lib/firebase/config'
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'

async function getOAuthClient(uid: string) {
  const snap = await getDoc(doc(db, 'googleTokens', uid))
  if (!snap.exists()) {
    throw new Error('Google no conectado. Ve a Integraciones → Conectar Google.')
  }
  const tokens = snap.data()
  if (!tokens?.access_token) {
    throw new Error('Token inválido. Ve a Integraciones → Reconectar Google.')
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2.setCredentials({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date:   tokens.expiry_date,
    token_type:    tokens.token_type ?? 'Bearer',
    scope:         tokens.scope,
  })

  // Auto-save refreshed tokens
  oauth2.on('tokens', async newTokens => {
    await setDoc(doc(db, 'googleTokens', uid), {
      ...tokens,
      ...newTokens,
      actualizadoEn: serverTimestamp(),
    }, { merge: true })
  })

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
  return Buffer.from(message).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function POST(req: NextRequest) {
  try {
    const { uid, to, subject, body, leadId, clienteId, oportunidadId } = await req.json()

    if (!uid || !to || !subject || !body) {
      return NextResponse.json({ error: 'Faltan campos: uid, to, subject, body' }, { status: 400 })
    }

    let auth
    try {
      auth = await getOAuthClient(uid)
    } catch (e: unknown) {
      return NextResponse.json({
        error: e instanceof Error ? e.message : 'Error de autenticación con Google',
      }, { status: 401 })
    }

    const gmail = google.gmail({ version: 'v1', auth })

    // Get sender email
    let fromEmail = ''
    try {
      const profile = await gmail.users.getProfile({ userId: 'me' })
      fromEmail = profile.data.emailAddress ?? ''
    } catch {
      return NextResponse.json({
        error: 'No se pudo acceder a Gmail. Reconectá Google en Integraciones con los permisos de Gmail.',
      }, { status: 403 })
    }

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

    // Common error messages in Spanish
    const friendly = msg.includes('insufficient') || msg.includes('permission')
      ? 'Permisos insuficientes. Reconectá Google en Integraciones y aceptá todos los permisos.'
      : msg.includes('invalid_grant') || msg.includes('Token')
      ? 'Token expirado. Ve a Integraciones → Reconectar Google.'
      : msg

    return NextResponse.json({ success: false, error: friendly }, { status: 500 })
  }
}
