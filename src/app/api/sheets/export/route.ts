import { type NextRequest, NextResponse } from 'next/server'
import { google }   from 'googleapis'
import { readDocs } from '@/lib/firebase/firestore'
import type { Lead, Oportunidad, Cliente } from '@/types'
import { Timestamp } from 'firebase/firestore'

function tsStr(ts: Timestamp | Date | undefined): string {
  if (!ts) return ''
  const d = ts instanceof Date ? ts : (ts as Timestamp).toDate()
  return d.toLocaleDateString('es-ES')
}

export async function POST(req: NextRequest) {
  try {
    const { access_token, refresh_token, expiry_date, scope, tipo } = await req.json()

    if (!access_token || !tipo) {
      return NextResponse.json({ error: 'access_token y tipo requeridos' }, { status: 400 })
    }

    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    )
    oauth2.setCredentials({ access_token, refresh_token, expiry_date })

    const sheets = google.sheets({ version: 'v4', auth: oauth2 })
    const hasDrive = scope && scope.includes('drive')

    let rows: string[][] = []
    let titulo = ''

    if (tipo === 'leads') {
      const data = await readDocs<Lead>('leads')
      titulo = `Fluxtic — Leads ${new Date().toLocaleDateString('es-ES')}`
      rows = [
        ['Nombre', 'Empresa', 'Email', 'Teléfono', 'Fuente', 'Estado', 'Notas', 'Creado'],
        ...data.map(l => [l.nombre, l.empresa, l.email, l.telefono ?? '', l.fuente, l.estado, l.notas ?? '', tsStr(l.creadoEn)]),
      ]
    } else if (tipo === 'oportunidades') {
      const data = await readDocs<Oportunidad>('oportunidades')
      titulo = `Fluxtic — Pipeline ${new Date().toLocaleDateString('es-ES')}`
      rows = [
        ['Título', 'Valor', 'Probabilidad', 'Etapa', 'Cierre estimado', 'Creado'],
        ...data.map(o => [o.titulo, String(o.valorEstimado), `${o.probabilidad}%`, o.etapa, tsStr(o.cierreEstimado), tsStr(o.creadoEn)]),
      ]
    } else if (tipo === 'clientes') {
      const data = await readDocs<Cliente>('clientes')
      titulo = `Fluxtic — Clientes ${new Date().toLocaleDateString('es-ES')}`
      rows = [
        ['Empresa', 'Nombre', 'Email', 'Sector', 'Estado', 'Contactos', 'Desde'],
        ...data.map(c => [c.empresa, c.nombre, c.email, c.sector ?? '', c.estado, String(c.contactos?.length ?? 0), tsStr(c.creadoEn)]),
      ]
    } else {
      return NextResponse.json({ error: 'tipo inválido' }, { status: 400 })
    }

    let spreadsheetId: string
    let url: string

    if (hasDrive) {
      // Use Drive API to create — file appears in My Drive with proper ownership
      const drive = google.drive({ version: 'v3', auth: oauth2 })
      const driveRes = await drive.files.create({
        requestBody: {
          name:     titulo,
          mimeType: 'application/vnd.google-apps.spreadsheet',
        },
        fields: 'id,webViewLink',
      })
      spreadsheetId = driveRes.data.id!
      url           = driveRes.data.webViewLink!
    } else {
      // Fallback: create via Sheets API — works without drive scope
      const created = await sheets.spreadsheets.create({
        requestBody: { properties: { title: titulo } },
      })
      spreadsheetId = created.data.spreadsheetId!
      url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    }

    // Write data
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
    const msg = err instanceof Error ? err.message : 'Error'
    const friendly = msg.includes('insufficient') || msg.includes('permission')
      ? 'Permisos insuficientes. Reconectá Google en Integraciones.'
      : msg.includes('invalid_grant')
      ? 'Token expirado. Ve a Integraciones → Reconectar Google.'
      : msg
    return NextResponse.json({ success: false, error: friendly }, { status: 500 })
  }
}
