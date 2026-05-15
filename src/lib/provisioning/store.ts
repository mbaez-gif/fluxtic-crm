import 'server-only'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb }   from '@/lib/firebase/server'
import type {
  ClientTenant,
  ProvisioningJob,
  ProvisioningLog,
  ClientDomain,
  ClientIntegration,
  ClientInitialUser,
  ClientWorkflow,
  ClientBackupConfig,
  JobStatus,
  JobStep,
  LogLevel,
} from '@/types/provisioning'

const COL = {
  clients:      'provisioning_clients',
  jobs:         'provisioning_jobs',
  logs:         'provisioning_logs',
  domains:      'provisioning_client_domains',
  integrations: 'provisioning_client_integrations',
  users:        'provisioning_client_users',
  workflows:    'provisioning_client_workflows',
  backups:      'provisioning_client_backups',
  fileBundles:  'provisioning_file_bundles',  // .env y docker-compose generados
} as const

// ── Clients ───────────────────────────────────────────────
export async function createClient(
  data: Omit<ClientTenant, 'id' | 'createdAt' | 'updatedAt' | 'lastBackupAt'>
): Promise<string> {
  const ref = adminDb().collection(COL.clients).doc()
  await ref.set({
    ...data,
    lastBackupAt: null,
    createdAt:    FieldValue.serverTimestamp(),
    updatedAt:    FieldValue.serverTimestamp(),
  })
  return ref.id
}

export async function findClientBySlug(slug: string): Promise<ClientTenant | null> {
  const snap = await adminDb().collection(COL.clients).where('slug', '==', slug).limit(1).get()
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as Omit<ClientTenant, 'id'>) }
}

export async function findClientById(id: string): Promise<ClientTenant | null> {
  const snap = await adminDb().collection(COL.clients).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as Omit<ClientTenant, 'id'>) }
}

export async function listClients(): Promise<ClientTenant[]> {
  const snap = await adminDb().collection(COL.clients).orderBy('createdAt', 'desc').get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ClientTenant, 'id'>) }))
}

export async function updateClient(id: string, data: Partial<ClientTenant>) {
  await adminDb().collection(COL.clients).doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function findDomainCollision(domain: string): Promise<string | null> {
  const refs = [
    adminDb().collection(COL.clients).where('crmDomain', '==', domain).limit(1).get(),
    adminDb().collection(COL.clients).where('n8nDomain', '==', domain).limit(1).get(),
    adminDb().collection(COL.clients).where('apiDomain', '==', domain).limit(1).get(),
  ]
  const results = await Promise.all(refs)
  for (const r of results) {
    if (!r.empty) return r.docs[0].id
  }
  return null
}

// ── Jobs ──────────────────────────────────────────────────
export async function createJob(data: {
  clientTenantId: string
  totalSteps:     number
  uid:            string
  userName:       string | null
}): Promise<string> {
  const ref = adminDb().collection(COL.jobs).doc()
  await ref.set({
    clientTenantId: data.clientTenantId,
    status:         'PENDIENTE' as JobStatus,
    currentStep:    null,
    totalSteps:     data.totalSteps,
    completedSteps: 0,
    startedAt:      null,
    finishedAt:     null,
    errorMessage:   null,
    createdById:    data.uid,
    createdByName:  data.userName,
    createdAt:      FieldValue.serverTimestamp(),
    updatedAt:      FieldValue.serverTimestamp(),
  })
  return ref.id
}

export async function findJobById(id: string): Promise<ProvisioningJob | null> {
  const snap = await adminDb().collection(COL.jobs).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as Omit<ProvisioningJob, 'id'>) }
}

export async function updateJob(
  id: string,
  data: Partial<Omit<ProvisioningJob, 'id' | 'createdAt'>>
) {
  await adminDb().collection(COL.jobs).doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function markJobStarted(id: string, step: JobStep) {
  await adminDb().collection(COL.jobs).doc(id).update({
    status:      'EN_PROCESO' as JobStatus,
    currentStep: step,
    startedAt:   FieldValue.serverTimestamp(),
    updatedAt:   FieldValue.serverTimestamp(),
  })
}

export async function bumpJobStep(id: string, step: JobStep, completed: number) {
  await adminDb().collection(COL.jobs).doc(id).update({
    currentStep:    step,
    completedSteps: completed,
    updatedAt:      FieldValue.serverTimestamp(),
  })
}

export async function markJobFinished(id: string, status: JobStatus, err?: string) {
  await adminDb().collection(COL.jobs).doc(id).update({
    status,
    finishedAt:   FieldValue.serverTimestamp(),
    errorMessage: err ?? null,
    updatedAt:    FieldValue.serverTimestamp(),
  })
}

// ── Logs ──────────────────────────────────────────────────
export async function appendLog(opts: {
  jobId:    string
  step:     JobStep
  level:    LogLevel
  message:  string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await adminDb().collection(COL.logs).add({
    jobId:    opts.jobId,
    step:     opts.step,
    level:    opts.level,
    message:  opts.message,
    metadata: opts.metadata ?? null,
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function listJobLogs(jobId: string): Promise<ProvisioningLog[]> {
  const snap = await adminDb().collection(COL.logs)
    .where('jobId', '==', jobId)
    .orderBy('createdAt', 'asc')
    .get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ProvisioningLog, 'id'>) }))
}

// ── Domains / Integrations / Users / Workflows / Backups ──
export async function saveDomain(data: Omit<ClientDomain, 'id' | 'createdAt'>) {
  await adminDb().collection(COL.domains).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function listDomains(clientTenantId: string): Promise<ClientDomain[]> {
  const snap = await adminDb().collection(COL.domains)
    .where('clientTenantId', '==', clientTenantId)
    .get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ClientDomain, 'id'>) }))
}

export async function saveIntegration(data: Omit<ClientIntegration, 'id' | 'createdAt' | 'updatedAt'>) {
  await adminDb().collection(COL.integrations).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function listIntegrations(clientTenantId: string): Promise<ClientIntegration[]> {
  const snap = await adminDb().collection(COL.integrations)
    .where('clientTenantId', '==', clientTenantId)
    .get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ClientIntegration, 'id'>) }))
}

export async function saveInitialUser(data: Omit<ClientInitialUser, 'id' | 'createdAt'>) {
  await adminDb().collection(COL.users).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function listInitialUsers(clientTenantId: string): Promise<ClientInitialUser[]> {
  const snap = await adminDb().collection(COL.users)
    .where('clientTenantId', '==', clientTenantId)
    .get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ClientInitialUser, 'id'>) }))
}

export async function saveWorkflow(data: Omit<ClientWorkflow, 'id' | 'createdAt'>) {
  await adminDb().collection(COL.workflows).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
  })
}

export async function listWorkflows(clientTenantId: string): Promise<ClientWorkflow[]> {
  const snap = await adminDb().collection(COL.workflows)
    .where('clientTenantId', '==', clientTenantId)
    .get()
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ClientWorkflow, 'id'>) }))
}

export async function saveBackupConfig(data: Omit<ClientBackupConfig, 'id' | 'createdAt' | 'updatedAt'>) {
  await adminDb().collection(COL.backups).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
}

export async function findBackupConfig(clientTenantId: string): Promise<ClientBackupConfig | null> {
  const snap = await adminDb().collection(COL.backups)
    .where('clientTenantId', '==', clientTenantId)
    .limit(1)
    .get()
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as Omit<ClientBackupConfig, 'id'>) }
}

// ── File bundles (.env + compose generados, una sola descarga) ─
export async function saveFileBundle(opts: {
  clientTenantId: string
  envFile:        string
  composeFile:    string
  metadataJson:   string
  createdById:    string
}): Promise<string> {
  const ref = adminDb().collection(COL.fileBundles).doc(opts.clientTenantId)
  await ref.set({
    envFile:       opts.envFile,
    composeFile:   opts.composeFile,
    metadataJson:  opts.metadataJson,
    createdById:   opts.createdById,
    revealed:      false,
    createdAt:     FieldValue.serverTimestamp(),
  })
  return ref.id
}

export async function readFileBundle(clientTenantId: string): Promise<{
  envFile: string
  composeFile: string
  metadataJson: string
  revealed: boolean
  createdAt: unknown
} | null> {
  const snap = await adminDb().collection(COL.fileBundles).doc(clientTenantId).get()
  if (!snap.exists) return null
  return snap.data() as {
    envFile: string
    composeFile: string
    metadataJson: string
    revealed: boolean
    createdAt: unknown
  }
}

export async function markFileBundleRevealed(clientTenantId: string) {
  await adminDb().collection(COL.fileBundles).doc(clientTenantId).update({ revealed: true })
}
