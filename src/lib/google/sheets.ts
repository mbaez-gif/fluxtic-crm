import { google }               from 'googleapis'
import { getAuthenticatedClient } from './oauth'
import type { Lead, Oportunidad, Cliente } from '@/types'
import { Timestamp } from 'firebase/firestore'

function tsToString(ts: Timestamp | Date | undefined): string {
  if (!ts) return ''
  const d = ts instanceof Date ? ts : (ts as Timestamp).toDate()
  return d.toLocaleDateString('es-ES')
}

// ── Create a new spreadsheet ──────────────────────────────
async function createSheet(uid: string, titulo: string) {
  const auth   = await getAuthenticatedClient(uid)
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.create({
    requestBody: { properties: { title: titulo } },
  })

  return {
    spreadsheetId: res.data.spreadsheetId ?? '',
    url:           res.data.spreadsheetUrl ?? '',
  }
}

// ── Write rows to a sheet ─────────────────────────────────
async function writeRows(
  uid:           string,
  spreadsheetId: string,
  rows:          string[][]
) {
  const auth   = await getAuthenticatedClient(uid)
  const sheets = google.sheets({ version: 'v4', auth })

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range:          'A1',
    valueInputOption: 'RAW',
    requestBody:    { values: rows },
  })
}

// ── Export Leads ──────────────────────────────────────────
export async function exportLeads(
  uid:   string,
  leads: Lead[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { spreadsheetId, url } = await createSheet(
      uid,
      `Fluxtic — Leads ${new Date().toLocaleDateString('es-ES')}`
    )

    const header = ['Nombre', 'Empresa', 'Email', 'Teléfono', 'Fuente', 'Estado', 'Notas', 'Creado']
    const rows   = leads.map(l => [
      l.nombre,
      l.empresa,
      l.email,
      l.telefono ?? '',
      l.fuente,
      l.estado,
      l.notas ?? '',
      tsToString(l.creadoEn),
    ])

    await writeRows(uid, spreadsheetId, [header, ...rows])
    return { success: true, url }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

// ── Export Oportunidades ──────────────────────────────────
export async function exportOportunidades(
  uid:   string,
  opors: Oportunidad[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { spreadsheetId, url } = await createSheet(
      uid,
      `Fluxtic — Pipeline ${new Date().toLocaleDateString('es-ES')}`
    )

    const header = ['Título', 'Valor (€)', 'Probabilidad (%)', 'Etapa', 'Cierre estimado', 'Creado']
    const rows   = opors.map(o => [
      o.titulo,
      String(o.valorEstimado),
      String(o.probabilidad),
      o.etapa,
      tsToString(o.cierreEstimado),
      tsToString(o.creadoEn),
    ])

    await writeRows(uid, spreadsheetId, [header, ...rows])
    return { success: true, url }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

// ── Export Clientes ───────────────────────────────────────
export async function exportClientes(
  uid:      string,
  clientes: Cliente[]
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const { spreadsheetId, url } = await createSheet(
      uid,
      `Fluxtic — Clientes ${new Date().toLocaleDateString('es-ES')}`
    )

    const header = ['Empresa', 'Nombre', 'Email', 'Sector', 'Estado', 'Contactos', 'Cliente desde']
    const rows   = clientes.map(c => [
      c.empresa,
      c.nombre,
      c.email,
      c.sector ?? '',
      c.estado,
      String(c.contactos?.length ?? 0),
      tsToString(c.creadoEn),
    ])

    await writeRows(uid, spreadsheetId, [header, ...rows])
    return { success: true, url }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error' }
  }
}

// ── Import Leads from CSV rows ────────────────────────────
export function parseLeadsFromRows(
  rows: string[][]
): Array<Partial<Lead>> {
  if (rows.length < 2) return []
  const [header, ...data] = rows
  const idx = (col: string) => header.findIndex(h => h.toLowerCase().includes(col.toLowerCase()))

  return data.map(row => ({
    nombre:   row[idx('nombre')]  ?? '',
    empresa:  row[idx('empresa')] ?? '',
    email:    row[idx('email')]   ?? '',
    telefono: row[idx('telefono')] ?? row[idx('teléfono')] ?? '',
    fuente:   'web' as const,
    estado:   'nuevo' as const,
    notas:    row[idx('notas')] ?? '',
  })).filter(l => l.email && l.nombre)
}
