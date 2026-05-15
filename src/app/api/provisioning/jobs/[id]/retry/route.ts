export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin, authErrorResponse, adminDb } from '@/lib/firebase/server'
import { FieldValue } from 'firebase-admin/firestore'
import { findJobById, appendLog } from '@/lib/provisioning/store'

// Reintento de un job. Sólo aplica si:
// - El job está en ERROR.
// - El CRM está en modo worker (si está en manual, no hay worker que
//   tome el retry; devolvemos 409 para que el operador re-ejecute por SSH).
//
// Comportamiento:
// - Resetea status=QUEUED, errorMessage=null, lease=null, currentStep=null.
// - Mantiene completedSteps en 9 (los pasos del CRM, que son inmutables).
// - El worker fluxtic-provisioner toma el job y re-ejecuta todos sus pasos.
//   Todos los pasos del worker son idempotentes:
//     - mkdir -p (no rompe si ya existe)
//     - writeFile (sobreescribe)
//     - docker network create (chequeado primero)
//     - docker compose pull (no-op si ya están las imágenes)
//     - docker compose up -d (mantiene contenedores existentes, recrea sólo si cambió config)
//     - waitForHealth (puramente lectura)
//     - prisma generate + migrate deploy (idempotentes)
//     - import workflows (best-effort, no falla)
//     - verify endpoint (lectura)
// - El cleanup automático seguro sigue valiendo en el retry: si el segundo
//   intento falla antes de STARTING_STACK borra la carpeta; si falla
//   después no toca nada.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let user
  try {
    user = await requireSuperAdmin(req.headers.get('authorization'))
  } catch (err) {
    const r = authErrorResponse(err); if (r) return r; throw err
  }

  const job = await findJobById(params.id)
  if (!job) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 })

  const mode = process.env.PROVISIONING_MODE === 'worker' ? 'worker' : 'manual'
  if (mode !== 'worker') {
    return NextResponse.json({
      ok: false,
      error: 'NOT_IN_WORKER_MODE',
      message: 'El reintento automático sólo funciona con PROVISIONING_MODE=worker. En modo manual, re-ejecutá los pasos por SSH.',
    }, { status: 409 })
  }

  if (job.status !== 'ERROR') {
    return NextResponse.json({
      ok: false,
      error: 'INVALID_STATUS',
      message: `Sólo se pueden reintentar jobs en estado ERROR. Estado actual: ${job.status}.`,
    }, { status: 409 })
  }

  await adminDb().collection('provisioning_jobs').doc(params.id).update({
    status:         'QUEUED',
    currentStep:    null,
    errorMessage:   null,
    leaseExpiresAt: null,
    workerId:       null,
    finishedAt:     null,
    retryCount:     FieldValue.increment(1),
    updatedAt:      FieldValue.serverTimestamp(),
  })

  await appendLog({
    jobId:    params.id,
    step:     'CLAIMING_JOB',
    level:    'warn',
    message:  `Reintento solicitado por ${user!.nombre ?? user!.email ?? user!.uid}`,
  })

  return NextResponse.json({ ok: true, jobId: params.id, status: 'QUEUED' })
}
