import { type NextRequest, NextResponse } from 'next/server'
import { createDoc }           from '@/lib/firebase/firestore'
import { notifyNuevoLead }     from '@/lib/slack'
import type { Lead }           from '@/types'

// ── Rate limiting simple (in-memory, resets on redeploy) ──
const rateMap = new Map<string, { count: number; ts: number }>()
const RATE_LIMIT  = 5      // requests
const RATE_WINDOW = 60_000 // 1 minute in ms

function isRateLimited(ip: string): boolean {
  const now  = Date.now()
  const entry = rateMap.get(ip)

  if (!entry || now - entry.ts > RATE_WINDOW) {
    rateMap.set(ip, { count: 1, ts: now })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true

  entry.count++
  return false
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta en un momento.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const { nombre, empresa, email, telefono, interes, origen, mensaje } = body

    // Validate required fields
    if (!nombre?.trim() || !email?.trim() || !empresa?.trim()) {
      return NextResponse.json(
        { error: 'nombre, empresa y email son obligatorios' },
        { status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }

    // Create lead in Firestore
    const leadId = await createDoc<Lead>('leads', {
      nombre:        nombre.trim(),
      empresa:       empresa.trim(),
      email:         email.trim().toLowerCase(),
      telefono:      telefono?.trim() ?? '',
      fuente:        'web',
      estado:        'nuevo',
      responsableId: '', // sin asignar — admin lo asigna
      notas:         [
        interes  ? `Interés: ${interes}`   : '',
        origen   ? `Origen: ${origen}`     : '',
        mensaje  ? `Mensaje: ${mensaje}`   : '',
      ].filter(Boolean).join('\n'),
    })

    // Notify Slack
    notifyNuevoLead(nombre, empresa, origen ?? 'Formulario web').catch(console.error)

    return NextResponse.json({
      success: true,
      leadId,
      message: 'Lead creado correctamente',
    })
  } catch (err) {
    console.error('Lead webhook error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// ── CORS for external forms ───────────────────────────────
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
