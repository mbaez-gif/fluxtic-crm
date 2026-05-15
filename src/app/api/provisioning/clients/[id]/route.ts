export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse } from '@/lib/firebase/server'
import {
  findClientById, listDomains, listIntegrations,
  listInitialUsers, listWorkflows, findBackupConfig,
} from '@/lib/provisioning/store'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }

  const client = await findClientById(params.id)
  if (!client) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  const [domains, integrations, users, workflows, backup] = await Promise.all([
    listDomains(params.id),
    listIntegrations(params.id),
    listInitialUsers(params.id),
    listWorkflows(params.id),
    findBackupConfig(params.id),
  ])

  return NextResponse.json({
    ok:           true,
    client,
    domains,
    integrations,
    users,
    workflows,
    backup,
  })
}
