import { type NextRequest, NextResponse } from 'next/server'
import { google }      from 'googleapis'
import { db }          from '@/lib/firebase/config'
import { doc, getDoc } from 'firebase/firestore'
import { readDocs }    from '@/lib/firebase/firestore'
import type { Lead, Oportunidad, Cliente } from '@/types'
import { Timestamp }   from 'firebase/firestore'

async function getOAuthClient(uid: string) {
  const snap = await getDoc(doc(db, 'googleTokens', uid))
  if (!snap.exists()) throw new Error('Google no conectado')
  const tokens = snap.data()
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
  oauth2.setCredentials({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date:   tokens.expiry_date,
    token_type:    tokens.token_type ?? 'Bearer',
  })
  return oauth2
}

function tsStr(ts: Timestamp | Date | undefined): string {
  if (!ts) return ''
  const d = ts instanceof Date ? ts : (ts as Timestamp).toDate()
  return d.toLocaleDateString('es-ES')
}

export async function POST(req: NextRequest) {
  try {
    const { uid, tipo } = await req.json()
    if (!uid || !tipo) return NextResponse.json({ error: 'uid y tipo requeridos' }, { status: 400 })

    const auth   = await getOAuthClient(uid)
    const sheets = google.sheets({ version: 'v4', auth })
    const drive  = google.drive({ version: 'v3', auth })

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
        ['Título', 'Valor (€)', 'Probabilidad', 'Etapa', 'Cierre', 'Creado'],
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

    // Create via Drive (avoids Sheets-only permission issues)
    const driveRes = await drive.files.create({
      requestBody: {
        name:     titulo,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      },
      fields: 'id,webViewLink',
    })

    const spreadsheetId = driveRes.data.id!
    const url           = driveRes.data.webViewLink!

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range:            'A1',
      valueInputOption: 'RAW',
      requestBody:      { values: rows },
    })

    return NextResponse.json({ success: true, url })
  } catch (err: unknown) {
    console.error('Sheets export error:', err)
    const error = err instanceof Error ? err.message : 'Error'
    return NextResponse.json({ success: false, error }, { status: 500 })
  }
}
