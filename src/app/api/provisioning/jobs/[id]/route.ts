export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse } from '@/lib/firebase/server'
import { findJobById } from '@/lib/provisioning/store'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }
  const job = await findJobById(params.id)
  if (!job) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  const progressPct = job.totalSteps > 0
    ? Math.round((job.completedSteps / job.totalSteps) * 100)
    : 0

  return NextResponse.json({ ok: true, job: { ...job, progressPct } })
}
