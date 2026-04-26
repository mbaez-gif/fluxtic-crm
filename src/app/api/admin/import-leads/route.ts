export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

const FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const FIREBASE_API_KEY  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

function toFirestoreValue(val: unknown): unknown {
  if (val === null || val === undefined || val === '') return { nullValue: null }
  if (typeof val === 'string')  return { stringValue: val }
  if (typeof val === 'number')  return { integerValue: String(Math.floor(val)) }
  if (typeof val === 'boolean') return { booleanValue: val }
  return { stringValue: String(val) }
}

function buildDoc(data: Record<string, unknown>) {
  const fields: Record<string, unknown> = {}
  const now = new Date().toISOString()
  for (const [key, val] of Object.entries(data)) {
    if (key === 'creadoEn' || key === 'actualizadoEn') {
      fields[key] = { timestampValue: now }
    } else {
      fields[key] = toFirestoreValue(val)
    }
  }
  return { fields }
}

export async function POST(req: NextRequest) {
  try {
    const { leads } = await req.json()
    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'Array de leads requerido' }, { status: 400 })
    }
    if (leads.length > 500) {
      return NextResponse.json({ error: 'Máximo 500 leads por batch' }, { status: 400 })
    }

    const BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`
    let ok = 0, errors = 0
    const errorDetails: string[] = []

    const tasks = leads.map((lead: Record<string, unknown>) => async () => {
      try {
        const res = await fetch(`${BASE_URL}/leads?key=${FIREBASE_API_KEY}`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(buildDoc(lead)),
        })
        if (res.ok) { ok++ }
        else {
          errors++
          if (errorDetails.length < 5) errorDetails.push(String(lead.nombre ?? ''))
        }
      } catch { errors++ }
    })

    const CONCURRENCY = 20
    for (let i = 0; i < tasks.length; i += CONCURRENCY) {
      await Promise.all(tasks.slice(i, i + CONCURRENCY).map(t => t()))
    }

    return NextResponse.json({ success: true, imported: ok, errors, errorDetails })
  } catch (err) {
    console.error('Import error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
