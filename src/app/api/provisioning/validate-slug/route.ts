export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse } from '@/lib/firebase/server'
import { validateSlugFormat } from '@/lib/provisioning/validators'
import { findClientBySlug }   from '@/lib/provisioning/store'

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }

  let body: { slug?: string }
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 }) }
  const slug = (body.slug ?? '').trim()

  const format = validateSlugFormat(slug)
  if (!format.ok) {
    return NextResponse.json({ ok: true, available: false, reason: format.reason })
  }

  const existing = await findClientBySlug(slug)
  if (existing) {
    return NextResponse.json({ ok: true, available: false, reason: 'Ya existe un cliente con ese slug' })
  }
  return NextResponse.json({ ok: true, available: true })
}
