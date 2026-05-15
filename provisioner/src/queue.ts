import { db, FieldValue, Timestamp } from './firebase.js'
import { COL, config } from './config.js'
import type { JobDoc, JobStatus, JobStep } from './types.js'

// Intenta tomar un job en estado QUEUED y dejarlo en EN_PROCESO con
// nuestro workerId + lease. Si otro worker se adelanta, devuelve null.
// La operación es atómica vía Firestore transaction.
export async function claimNextJob(): Promise<{ jobId: string; job: JobDoc } | null> {
  // Buscamos candidatos: QUEUED ó (EN_PROCESO con lease expirado).
  const now = Timestamp.now()
  const queued = await db.collection(COL.jobs)
    .where('status', '==', 'QUEUED')
    .orderBy('createdAt', 'asc')
    .limit(5)
    .get()

  const candidates = [...queued.docs]

  // Recuperar leases expirados (worker que murió en medio).
  const stale = await db.collection(COL.jobs)
    .where('status', '==', 'EN_PROCESO')
    .where('leaseExpiresAt', '<', now)
    .limit(5)
    .get()
  candidates.push(...stale.docs)

  for (const docSnap of candidates) {
    try {
      const claimed = await db.runTransaction(async tx => {
        const fresh = await tx.get(docSnap.ref)
        if (!fresh.exists) return null
        const data = fresh.data() as JobDoc & { leaseExpiresAt?: Timestamp }
        const isQueued = data.status === 'QUEUED'
        const isStale  = data.status === 'EN_PROCESO'
          && data.leaseExpiresAt
          && (data.leaseExpiresAt as Timestamp).toMillis() < Date.now()
        if (!isQueued && !isStale) return null

        const newLease = Timestamp.fromMillis(Date.now() + config.leaseTtlSeconds * 1000)
        tx.update(docSnap.ref, {
          status:         'EN_PROCESO' satisfies JobStatus,
          workerId:       config.workerId,
          leaseExpiresAt: newLease,
          startedAt:      data.status === 'QUEUED' ? FieldValue.serverTimestamp() : (fresh.get('startedAt') ?? FieldValue.serverTimestamp()),
          updatedAt:      FieldValue.serverTimestamp(),
        })
        return data
      })

      if (claimed) {
        return { jobId: docSnap.id, job: claimed }
      }
    } catch (e) {
      // Otro worker se adelantó — seguimos al próximo.
      console.error('[queue] claim transaction failed', e)
    }
  }

  return null
}

// Renueva el lease mientras el job se está ejecutando, para que otro
// worker no piense que estamos muertos. Lo llamamos entre pasos.
export async function renewLease(jobId: string): Promise<void> {
  const newLease = Timestamp.fromMillis(Date.now() + config.leaseTtlSeconds * 1000)
  await db.collection(COL.jobs).doc(jobId).update({
    leaseExpiresAt: newLease,
    updatedAt:      FieldValue.serverTimestamp(),
  })
}

export async function bumpJobStep(jobId: string, step: JobStep, completed: number): Promise<void> {
  await db.collection(COL.jobs).doc(jobId).update({
    currentStep:    step,
    completedSteps: completed,
    updatedAt:      FieldValue.serverTimestamp(),
  })
  await renewLease(jobId)
}

export async function finishJob(jobId: string, status: JobStatus, errorMessage?: string): Promise<void> {
  await db.collection(COL.jobs).doc(jobId).update({
    status,
    errorMessage:   errorMessage ?? null,
    finishedAt:     FieldValue.serverTimestamp(),
    updatedAt:      FieldValue.serverTimestamp(),
    leaseExpiresAt: null,
  })
}
