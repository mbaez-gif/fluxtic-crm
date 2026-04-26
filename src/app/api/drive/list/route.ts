export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(req: NextRequest) {
  try {
    const { access_token, refresh_token, expiry_date, folderId } = await req.json()

    if (!access_token || !folderId) {
      return NextResponse.json({ error: 'access_token y folderId requeridos' }, { status: 400 })
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    )
    oauth2.setCredentials({ access_token, refresh_token, expiry_date })
    const drive = google.drive({ version: 'v3', auth: oauth2 })

    const res = await drive.files.list({
      q:      `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size,webViewLink,thumbnailLink,createdTime)',
      orderBy: 'createdTime desc',
    })

    return NextResponse.json({ success: true, files: res.data.files ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
