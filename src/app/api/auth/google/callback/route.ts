import { type NextRequest, NextResponse } from 'next/server'
import { google }     from 'googleapis'
import { db }         from '@/lib/firebase/config'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const uid  = searchParams.get('state')

  if (!code || !uid) {
    return NextResponse.redirect(new URL('/integraciones?error=oauth_failed', req.url))
  }

  try {
    const oauth2     = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    const { tokens } = await oauth2.getToken(code)

    await setDoc(doc(db, 'googleTokens', uid), {
      ...tokens,
      actualizadoEn: serverTimestamp(),
    }, { merge: true })

    return NextResponse.redirect(new URL('/integraciones?connected=google', req.url))
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/integraciones?error=token_failed', req.url))
  }
}
