import { type NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function POST(req: NextRequest) {
  try {
    const {
      access_token, refresh_token, expiry_date,
      tipo, rows, titulo,
    } = await req.json()

    if (!access_token || !rows || !titulo) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 })
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    oauth2.setCredentials({ access_token, refresh_token, expiry_date })

    const sheets = google.sheets({ version: 'v4', auth: oauth2 })

    // Create spreadsheet
    const created = await sheets.spreadsheets.create({
      requestBody: { properties: { title: titulo } },
    })

    const spreadsheetId = created.data.spreadsheetId!
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`

    // Write rows (received from client)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            'A1',
      valueInputOption: 'RAW',
      requestBody:      { values: rows },
    })

    // Bold header
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat',
          },
        }],
      },
    })

    return NextResponse.json({ success: true, url })
  } catch (err: unknown) {
    console.error('Sheets export error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
