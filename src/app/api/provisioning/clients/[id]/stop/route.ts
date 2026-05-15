export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse } from '@/lib/firebase/server'
import { findClientById } from '@/lib/provisioning/store'

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
    message: 'En V1 el stop se ejecuta por SSH.',
    sshCommand: `docker compose -f ${client.folderPath}/docker-compose.yml stop`,
  }, { status: 501 })
}
