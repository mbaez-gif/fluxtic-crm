export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
const API_KEY  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
const BASE     = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

export async function POST() {
  try {
    const url = `${BASE}/_counters/leads?key=${API_KEY}`
    const res = await fetch(url)
    const current = res.ok
      ? parseInt((await res.json()).fields?.count?.integerValue ?? '0')
      : 0
    const next   = current + 1
    const leadId = `LEAD-${String(next).padStart(4, '0')}`

    await fetch(url, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { count: { integerValue: String(next) } } }),
    })

    return NextResponse.json({ success: true, leadId })
  } catch (err) {
    console.error('Error generating lead ID:', err)
    return NextResponse.json({ success: false, leadId: `LEAD-${Date.now().toString().slice(-6)}` })
  }
}
