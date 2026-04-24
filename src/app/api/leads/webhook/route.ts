import { type NextRequest, NextResponse } from 'next/server'

const FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const FIREBASE_API_KEY  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

async function saveToFirestore(col: string, data: Record<string, unknown>) {
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents/${col}?key=${FIREBASE_API_KEY}`

  function toValue(val: unknown): unknown {
    if (val === null || val === undefined) return { nullValue: null }
    if (typeof val === 'string')  return { stringValue: val }
    if (typeof val === 'number')  return { integerValue: String(Math.floor(val)) }
    if (typeof val === 'boolean') return { booleanValue: val }
    return { stringValue: String(val) }
  }

  const now = new Date().toISOString()
  const fields: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(data)) {
    if (key === 'creadoEn' || key === 'actualizadoEn') {
      // Store as Firestore timestamp
      fields[key] = { timestampValue: now }
    } else {
      fields[key] = toValue(val)
    }
  }

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  })

  if (!res.ok) throw new Error(`Firestore error: ${await res.text()}`)
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

const rateMap = new Map<string, { count: number; ts: number }>()
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const e   = rateMap.get(ip)
  if (!e || now - e.ts > 60_000) { rateMap.set(ip, { count: 1, ts: now }); return false }
  if (e.count >= 5) return true
  e.count++; return false
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(ip)) return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 })

  try {
    const { nombre, empresa, email, telefono, interes, origen, mensaje } = await req.json()

    if (!nombre?.trim() || !email?.trim() || !empresa?.trim()) {
      return NextResponse.json({ error: 'nombre, empresa y email son obligatorios' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    const notas = [interes && `Interés: ${interes}`, origen && `Origen: ${origen}`, mensaje && `Mensaje: ${mensaje}`].filter(Boolean).join('\n')

    await saveToFirestore('leads', {
      nombre:        nombre.trim(),
      empresa:       empresa.trim(),
      email:         email.trim().toLowerCase(),
      telefono:      telefono?.trim() ?? '',
      fuente:        'web',
      estado:        'nuevo',
      responsableId: '',
      notas,
      creadoEn:      '__timestamp__',
      actualizadoEn: '__timestamp__',
    })

    await sendSlack(
      `🟢 *Nuevo lead desde formulario web*\n` +
      `*Nombre:* ${nombre.trim()}\n*Empresa:* ${empresa.trim()}\n` +
      `*Email:* ${email.trim()}\n*Teléfono:* ${telefono?.trim() || '-'}\n` +
      `*Interés:* ${interes || '-'}\n*Mensaje:* ${mensaje || '-'}\n` +
      `👉 https://fluxtic-crm.vercel.app/leads`
    )

    return NextResponse.json({ success: true })
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
