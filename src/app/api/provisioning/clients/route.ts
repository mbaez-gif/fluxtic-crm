export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse } from '@/lib/firebase/server'
import { provisionClient, ProvisioningError }   from '@/lib/provisioning/service'
import { listClients }                          from '@/lib/provisioning/store'
import type { CreateClientPayload }             from '@/types/provisioning'

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }
  const clients = await listClients()
  return NextResponse.json({ ok: true, clients })
}

export async function POST(req: NextRequest) {
  let user
  try {
    user = await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }

  let payload: CreateClientPayload
  try { payload = (await req.json()) as CreateClientPayload }
  catch { return NextResponse.json({ ok: false, error: 'INVALID_JSON' }, { status: 400 }) }

  try {
    const result = await provisionClient({
      payload,
      uid:      user!.uid,
      userName: user!.nombre,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (e) {
    if (e instanceof ProvisioningError) {
      return NextResponse.json({ ok: false, error: e.code, message: e.message }, { status: 422 })
    }
    console.error('[provisioning] POST /clients', e)
    return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 })
  }
}
