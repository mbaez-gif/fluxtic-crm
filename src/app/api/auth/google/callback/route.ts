export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

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

    // En vez de guardar en Firestore desde el servidor (requiere Admin SDK),
    // pasamos los tokens al cliente via URL para que los guarde con su sesión Auth
    const params = new URLSearchParams({
      google_connected: '1',
      uid,
      access_token:     tokens.access_token  ?? '',
      refresh_token:    tokens.refresh_token ?? '',
      expiry_date:      String(tokens.expiry_date ?? ''),
      token_type:       tokens.token_type    ?? 'Bearer',
    })

    return NextResponse.redirect(
      new URL(`/integraciones/save-token?${params.toString()}`, req.url)
    )
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/integraciones?error=token_failed', req.url))
  }
}
