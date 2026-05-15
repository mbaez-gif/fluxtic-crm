export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse } from '@/lib/firebase/server'
import { findClientById } from '@/lib/provisioning/store'

// V1: no se ejecuta backup desde el panel. El endpoint devuelve la
// instrucción exacta a correr por SSH para mantener la lista cerrada
// de acciones permitidas.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }
  const client = await findClientById(params.id)
  if (!client) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  return NextResponse.json({
    ok:    false,
    error: 'NOT_IMPLEMENTED_V1',
    message: 'En V1 los backups se ejecutan por SSH. En V2 esta acción correrá automáticamente.',
    sshCommand: `bash /opt/fluxtic/scripts/backup-postgres.sh ${client.slug}`,
  }, { status: 501 })
}
