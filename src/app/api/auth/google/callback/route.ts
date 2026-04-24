import { type NextRequest, NextResponse } from 'next/server'
import { getOAuth2Client, saveTokens }   from '@/lib/google/oauth'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const uid  = searchParams.get('state') // uid passed as state param

  if (!code || !uid) {
    return NextResponse.redirect(new URL('/integraciones?error=oauth_failed', req.url))
  }

  try {
    const oauth2       = getOAuth2Client()
    const { tokens }   = await oauth2.getToken(code)
    await saveTokens(uid, tokens)

    return NextResponse.redirect(new URL('/integraciones?connected=google', req.url))
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/integraciones?error=token_failed', req.url))
  }
}
