export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'

// NO Firebase SDK imports — uses REST API to avoid build-time init errors

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')

  if (!uid) return NextResponse.json({ connected: false })

  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const apiKey  = process.env.NEXT_PUBLIC_FIREBASE_API_KEY

  if (!project || !apiKey) return NextResponse.json({ connected: false })

  try {
    const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/googleTokens/${uid}?key=${apiKey}`
    const res  = await fetch(url)

    if (!res.ok) return NextResponse.json({ connected: false })

    const doc = await res.json()
    const hasToken = !!(doc?.fields?.access_token?.stringValue)

    return NextResponse.json({ connected: hasToken })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
