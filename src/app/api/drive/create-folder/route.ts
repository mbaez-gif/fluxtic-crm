export const dynamic = 'force-dynamic'

import { type NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(req: NextRequest) {
  try {
    const {
      access_token, refresh_token, expiry_date,
      clienteNombre, clienteId,
      parentFolderId,  // optional — parent folder ID
    } = await req.json()

    if (!access_token || !clienteNombre) {
      return NextResponse.json({ error: 'access_token y clienteNombre requeridos' }, { status: 400 })
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    )
    oauth2.setCredentials({ access_token, refresh_token, expiry_date })
    const drive = google.drive({ version: 'v3', auth: oauth2 })

    // Create main client folder
    const folderName = `Fluxtic — ${clienteNombre}`
    const folderMeta = {
      name:     folderName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentFolderId && { parents: [parentFolderId] }),
    }

    const folder = await drive.files.create({
      requestBody: folderMeta,
      fields:      'id,name,webViewLink',
    })

    const folderId = folder.data.id!

    // Create sub-folders
    const subfolders = ['Propuestas', 'Contratos', 'Facturas', 'Recursos']
    await Promise.all(subfolders.map(name =>
      drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents:  [folderId],
        },
        fields: 'id,name',
      })
    ))

    return NextResponse.json({
      success:     true,
      folderId,
      folderName:  folder.data.name,
      webViewLink: folder.data.webViewLink,
    })
  } catch (err: unknown) {
    console.error('Drive create folder error:', err)
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
