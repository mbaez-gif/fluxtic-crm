import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'

const rateMap = new Map<string, { count: number; ts: number }>()

function isRateLimited(ip: string): boolean {
  const now   = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || now - entry.ts > 60_000) {
    rateMap.set(ip, { count: 1, ts: now })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
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

    const notas = [
      interes  ? `Interés: ${interes}`   : '',
      origen   ? `Origen: ${origen}`     : '',
      mensaje  ? `Mensaje: ${mensaje}`   : '',
    ].filter(Boolean).join('\n')

    const ref = await addDoc(collection(db, 'leads'), {
      nombre:        nombre.trim(),
      empresa:       empresa.trim(),
      email:         email.trim().toLowerCase(),
      telefono:      telefono?.trim() ?? '',
      fuente:        'web',
      estado:        'nuevo',
      responsableId: '',
      notas,
      creadoEn:      serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    })

    // Slack notification — fire and forget, won't break if fails
    if (process.env.SLACK_WEBHOOK_URL) {
      fetch(process.env.SLACK_WEBHOOK_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🟢 Nuevo lead desde formulario web\n*${nombre}* — ${empresa} (${email})`,
        }),
      }).catch(() => {}) // silently ignore
    }

    return NextResponse.json({ success: true, leadId: ref.id })
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
