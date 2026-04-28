export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

const PROJECT      = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const API_KEY      = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const SLACK_URL    = process.env.SLACK_WEBHOOK_URL
const BASE         = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

async function generateLeadId(): Promise<string> {
  try {
    const url = `${BASE}/_counters/leads?key=${API_KEY}`
    const res = await fetch(url)
    const current = res.ok
      ? parseInt((await res.json()).fields?.count?.integerValue ?? '0')
      : 0
    const next = current + 1
    await fetch(url, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { count: { integerValue: String(next) } } }),
    })
    return `LEAD-${String(next).padStart(4, '0')}`
  } catch {
    return `LEAD-${Date.now().toString().slice(-6)}`
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, empresa, email, telefono, interes, origen, mensaje } = body

    if (!nombre?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'nombre y email son obligatorios' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const leadId = await generateLeadId()

    const notas = [
      interes ? `Interés: ${interes}` : '',
      origen  ? `Origen: ${origen}`   : '',
      mensaje ? `Mensaje: ${mensaje}` : '',
    ].filter(Boolean).join('\n')

    const now = new Date().toISOString()
    const fields = {
      leadId:        { stringValue: leadId },
      nombre:        { stringValue: nombre.trim() },
      empresa:       { stringValue: empresa?.trim() ?? '' },
      email:         { stringValue: email.trim().toLowerCase() },
      telefono:      { stringValue: telefono?.trim() ?? '' },
      fuente:        { stringValue: 'web' },
      estado:        { stringValue: 'nuevo' },
      notas:         { stringValue: notas },
      responsableId: { stringValue: '' },
      creadoEn:      { timestampValue: now },
      actualizadoEn: { timestampValue: now },
    }

    const res = await fetch(`${BASE}/leads?key=${API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })

    if (!res.ok) {
      const err = await res.json()
      return NextResponse.json({ error: err.error?.message ?? 'Error Firestore' }, { status: 500 })
    }

    // Notificación Slack
    if (SLACK_URL) {
      fetch(SLACK_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🆕 *[${leadId}]* Nuevo lead: *${nombre.trim()}*${empresa ? ` — ${empresa.trim()}` : ''}\n📧 ${email}\n📍 ${origen ?? 'Sitio web'}`,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, leadId })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
