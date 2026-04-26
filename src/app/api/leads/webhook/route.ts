export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

// Use Firebase REST API directly — no Auth session needed with API key
const FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const FIREBASE_API_KEY  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function saveToFirestore(collection: string, data: Record<string, unknown>) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${collection}?key=${FIREBASE_API_KEY}`

  // Convert data to Firestore REST format
  function toFirestoreValue(val: unknown): unknown {
    if (val === null || val === undefined) return { nullValue: null }
    if (typeof val === 'string')  return { stringValue: val }
    if (typeof val === 'number')  return { integerValue: String(val) }
    if (typeof val === 'boolean') return { booleanValue: val }
    if (val instanceof Date)      return { timestampValue: val.toISOString() }
    if (typeof val === 'object')  return { mapValue: { fields: Object.fromEntries(Object.entries(val as Record<string, unknown>).map(([k, v]) => [k, toFirestoreValue(v)])) } }
    return { stringValue: String(val) }
  }

  const fields: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data)) {
    fields[key] = toFirestoreValue(val)
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Firestore error: ${err}`)
  }

  return res.json()
}

async function sendSlack(message: string) {
  if (!process.env.SLACK_WEBHOOK_URL) return
  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text: message }),
  }).catch(() => {})
}

// Rate limiting
const rateMap = new Map<string, { count: number; ts: number }>()
function isRateLimited(ip: string): boolean {
  const now   = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now - entry.ts > 60_000) { rateMap.set(ip, { count: 1, ts: now }); return false }
  if (entry.count >= 5) return true
  entry.count++; return false
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { nombre, empresa, email, telefono, interes, origen, mensaje } = body

    if (!nombre?.trim() || !email?.trim() || !empresa?.trim()) {
      return NextResponse.json({ error: 'nombre, empresa y email son obligatorios' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const now   = new Date().toISOString()
    const notas = [
      interes  ? `Interés: ${interes}`   : '',
      origen   ? `Origen: ${origen}`     : '',
      mensaje  ? `Mensaje: ${mensaje}`   : '',
    ].filter(Boolean).join('\n')

    // 1 — Create lead
    await saveToFirestore('leads', {
      nombre:        nombre.trim(),
      empresa:       empresa.trim(),
      email:         email.trim().toLowerCase(),
      telefono:      telefono?.trim() ?? '',
      fuente:        'web',
      estado:        'nuevo',
      responsableId: '',
      notas,
      creadoEn:      now,
      actualizadoEn: now,
    })

    // 2 — Send Slack notification
    await sendSlack(
      `🟢 *Nuevo lead desde formulario web*\n` +
      `*Nombre:* ${nombre.trim()}\n` +
      `*Empresa:* ${empresa.trim()}\n` +
      `*Email:* ${email.trim()}\n` +
      `*Teléfono:* ${telefono?.trim() || '-'}\n` +
      `*Interés:* ${interes || '-'}\n` +
      `*Mensaje:* ${mensaje || '-'}\n` +
      `👉 Ver en CRM: https://fluxtic-crm.vercel.app/leads`
    )

    return NextResponse.json({ success: true, message: 'Lead creado correctamente' })
  } catch (err) {
    console.error('Lead webhook error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
