export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

const FIREBASE_PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const FIREBASE_API_KEY  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

const BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`

async function getDoc(path: string) {
  const res = await fetch(`${BASE}/${path}?key=${FIREBASE_API_KEY}`)
  if (!res.ok) return null
  return res.json()
}

async function setDoc(path: string, fields: Record<string, unknown>) {
  await fetch(`${BASE}/${path}?key=${FIREBASE_API_KEY}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
}

export async function POST(req: NextRequest) {
  try {
    // Get current counter
    const doc = await getDoc('_counters/leads')
    const current = doc?.fields?.count?.integerValue
      ? parseInt(doc.fields.count.integerValue)
      : 0

    const next   = current + 1
    const leadId = `LEAD-${String(next).padStart(4, '0')}`

    // Update counter
    await setDoc('_counters/leads', {
      count: { integerValue: String(next) },
    })

    return NextResponse.json({ success: true, leadId })
  } catch (err) {
    console.error('Error generating lead ID:', err)
    return NextResponse.json({ success: false, error: 'Error generando ID' }, { status: 500 })
  }
}
