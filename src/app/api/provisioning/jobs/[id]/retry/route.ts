export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse } from '@/lib/firebase/server'
import { findJobById } from '@/lib/provisioning/store'

// V1 no soporta retry automático: el job V1 termina en
// PENDING_MANUAL_EXECUTION cuando todo OK, o en ERROR si la validación
// falla antes de tocar Firestore (en cuyo caso no hay job creado todavía).
//
// Cuando exista la cola de jobs (V3), este endpoint reanudará desde el
// paso fallido si el estado es ERROR y el paso es seguro de reintentar.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }
  const job = await findJobById(params.id)
  if (!job) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  return NextResponse.json({
    ok:    false,
    error: 'NOT_IMPLEMENTED_V1',
    message: 'Retry automático estará disponible en V3 (worker + cola de jobs).',
  }, { status: 501 })
}
