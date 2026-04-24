import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase/config'
import { doc, getDoc } from 'firebase/firestore'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid = searchParams.get('uid')

  if (!uid) {
    return NextResponse.json({ connected: false })
  }

  try {
    const snap = await getDoc(doc(db, 'googleTokens', uid))
    const connected = snap.exists() && !!snap.data()?.access_token
    return NextResponse.json({ connected })
  } catch {
    return NextResponse.json({ connected: false })
  }
}
