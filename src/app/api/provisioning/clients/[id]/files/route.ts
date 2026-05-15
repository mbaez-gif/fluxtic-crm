export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse } from '@/lib/firebase/server'
import { readFileBundle, markFileBundleRevealed } from '@/lib/provisioning/store'

// Devuelve el .env y docker-compose.yml generados para que el super_admin
// los baje y los suba por SSH al servidor. Marca el bundle como revealed.
// En V2 esto se restringirá a 24 hs post-creación.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }

  const bundle = await readFileBundle(params.id)
  if (!bundle) return NextResponse.json({ ok: false, error: 'NO_BUNDLE' }, { status: 404 })

  // Una vez consumido lo marcamos. La V1 todavía deja leer dos veces
  // (puede haber refresh), pero v2 cortará luego de la primera lectura.
  if (!bundle.revealed) {
    await markFileBundleRevealed(params.id)
  }

  return NextResponse.json({
    ok: true,
    envFile:      bundle.envFile,
    composeFile:  bundle.composeFile,
    metadataJson: bundle.metadataJson,
    alreadyRevealed: bundle.revealed,
  })
}
