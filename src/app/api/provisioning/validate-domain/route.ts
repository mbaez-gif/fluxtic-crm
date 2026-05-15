export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse } from '@/lib/firebase/server'
import { validateDomainFormat }    from '@/lib/provisioning/validators'
import { findDomainCollision }     from '@/lib/provisioning/store'

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }

  let body: { domain?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 }) }
  const domain = (body.domain ?? '').trim().toLowerCase()

  const format = validateDomainFormat(domain)
  if (!format.ok) {
    return NextResponse.json({ ok: true, available: false, reason: format.reason })
  }
  const collision = await findDomainCollision(domain)
  if (collision) {
    return NextResponse.json({ ok: true, available: false, reason: 'Ese dominio ya está asignado a otro cliente' })
  }
  return NextResponse.json({ ok: true, available: true })
}
