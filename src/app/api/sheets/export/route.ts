import { type NextRequest, NextResponse } from 'next/server'
import { exportLeads, exportOportunidades, exportClientes } from '@/lib/google/sheets'
import { readDocs } from '@/lib/firebase/firestore'
import type { Lead, Oportunidad, Cliente } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const { uid, tipo } = await req.json()

    if (!uid || !tipo) {
      return NextResponse.json({ error: 'uid y tipo son requeridos' }, { status: 400 })
    }

    let result: { success: boolean; url?: string; error?: string }

    if (tipo === 'leads') {
      const leads = await readDocs<Lead>('leads')
      result = await exportLeads(uid, leads)
    } else if (tipo === 'oportunidades') {
      const opors = await readDocs<Oportunidad>('oportunidades')
      result = await exportOportunidades(uid, opors)
    } else if (tipo === 'clientes') {
      const clientes = await readDocs<Cliente>('clientes')
      result = await exportClientes(uid, clientes)
    } else {
      return NextResponse.json({ error: 'tipo inválido. Usa: leads | oportunidades | clientes' }, { status: 400 })
    }

    if (result.success) {
      return NextResponse.json({ success: true, url: result.url })
    } else {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
  } catch (err) {
    console.error('Sheets export error:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
