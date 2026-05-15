import { db, FieldValue } from './firebase.js'
import { COL, config } from './config.js'
import { persistLog, logLine } from './logger.js'
import { bumpJobStep, finishJob, renewLease } from './queue.js'
import { assertSafeSlug, assertSafeContainerName } from './safety.js'
import {
  prepareFolder, prepareBackupFolder,
  writeEnvFile, writeComposeFile, writeMetadataFile,
  removeFolder, folderExists,
} from './fs-ops.js'
import { ensureNetwork, composePull, composeUp, composeDown, composeExec, DockerError } from './docker.js'
import { waitForHealth } from './healthcheck.js'
import { migrationPlanFor } from './product-migrations.js'
import type {
  ClientStatus, ClientTenantDoc, FileBundleDoc, JobDoc, JobStep,
} from './types.js'

// Pasos del worker en orden. Cada paso reporta progreso vía bumpJobStep.
const WORKER_STEPS: JobStep[] = [
  'CLAIMING_JOB',
  'PREPARING_FOLDER',
  'WRITING_FILES',
  'ENSURING_NETWORK',
  'PULLING_IMAGES',
  'STARTING_STACK',
  'WAITING_HEALTH',
  'RUNNING_MIGRATIONS',
  'VERIFYING_ENDPOINT',
  'FINALIZADO',
]

// El cutoff del cleanup seguro: cualquier fallo ANTES de este paso permite
// borrar la carpeta. A partir de este paso (inclusive), dejamos todo.
const CLEANUP_CUTOFF: JobStep = 'STARTING_STACK'

export async function executeJob(jobId: string, job: JobDoc): Promise<void> {
  await persistLog({ jobId, step: 'CLAIMING_JOB', level: 'info', message: `Worker ${config.workerId} tomó el job` })

  // Cargar cliente + bundle. Si algo está mal, fallamos antes de tocar disco.
  const clientSnap = await db.collection(COL.clients).doc(job.clientTenantId).get()
  if (!clientSnap.exists) {
    await failNoCleanup(jobId, 'CLAIMING_JOB', 'Cliente no encontrado en Firestore')
    return
  }
  const client = clientSnap.data() as ClientTenantDoc

  const bundleSnap = await db.collection(COL.fileBundles).doc(job.clientTenantId).get()
  if (!bundleSnap.exists) {
    await failNoCleanup(jobId, 'CLAIMING_JOB', 'No hay file bundle (.env + compose) en Firestore')
    return
  }
  const bundle = bundleSnap.data() as FileBundleDoc

  // Defensa en profundidad
  try {
    assertSafeSlug(client.slug)
    assertSafeContainerName(client.dockerProjectName)
    assertSafeContainerName(client.postgresContainer)
    assertSafeContainerName(client.apiContainer)
    assertSafeContainerName(client.appContainer)
    assertSafeContainerName(client.n8nContainer)
  } catch (e) {
    await failNoCleanup(jobId, 'CLAIMING_JOB', (e as Error).message)
    return
  }

  // Marcar cliente como "creando" (V2 no usa pendiente_manual)
  await db.collection(COL.clients).doc(job.clientTenantId).update({
    status:    'creando' satisfies ClientStatus,
    updatedAt: FieldValue.serverTimestamp(),
  })

  // Estado del rollback. `bootstrapPoint` se actualiza con cada paso.
  let currentStep: JobStep = 'CLAIMING_JOB'
  let composePath = ''
  let envPath     = ''

  // El CRM ya bumpeó completedSteps en sus pasos. El worker continúa
  // desde ese offset para que la barra de progreso no retroceda.
  let completed = job.completedSteps ?? 0
  const tick = () => ++completed

  try {
    // ── PREPARING_FOLDER ─────────────────────────────────
    currentStep = 'PREPARING_FOLDER'
    await bumpJobStep(jobId, currentStep, tick())
    await prepareFolder(client.folderPath)
    await prepareBackupFolder(client.backupPath)
    await persistLog({ jobId, step: currentStep, level: 'success',
      message: `Carpetas listas en ${client.folderPath}` })

    // ── WRITING_FILES ────────────────────────────────────
    currentStep = 'WRITING_FILES'
    await bumpJobStep(jobId, currentStep, tick())
    envPath     = await writeEnvFile(client.folderPath, bundle.envFile)
    composePath = await writeComposeFile(client.folderPath, bundle.composeFile)
    await writeMetadataFile(client.folderPath, bundle.metadataJson)
    await persistLog({ jobId, step: currentStep, level: 'success',
      message: '.env (chmod 600), docker-compose.yml y metadata.json escritos' })

    // ── ENSURING_NETWORK ─────────────────────────────────
    currentStep = 'ENSURING_NETWORK'
    await bumpJobStep(jobId, currentStep, tick())
    const net = await ensureNetwork(config.proxyNetwork)
    await persistLog({ jobId, step: currentStep, level: net.created ? 'warn' : 'info',
      message: net.created
        ? `Red ${config.proxyNetwork} no existía — fue creada ahora`
        : `Red ${config.proxyNetwork} ya existe` })

    // ── PULLING_IMAGES ───────────────────────────────────
    currentStep = 'PULLING_IMAGES'
    await bumpJobStep(jobId, currentStep, tick())
    const pull = await composePull(composePath, envPath, client.dockerProjectName)
    await persistLog({ jobId, step: currentStep, level: 'info',
      message: 'docker compose pull completado',
      metadata: { stderr: pull.stderr.slice(0, 600) } })

    // ── STARTING_STACK ───────────────────────────────────
    // A partir de acá ya hay contenedores en docker — el cleanup deja de ser seguro.
    currentStep = 'STARTING_STACK'
    await bumpJobStep(jobId, currentStep, tick())
    const up = await composeUp(composePath, envPath, client.dockerProjectName)
    await persistLog({ jobId, step: currentStep, level: 'success',
      message: 'docker compose up -d completado',
      metadata: { stderr: up.stderr.slice(0, 600) } })

    // ── WAITING_HEALTH ───────────────────────────────────
    currentStep = 'WAITING_HEALTH'
    await bumpJobStep(jobId, currentStep, tick())
    await waitForHealth({
      composePath, envPath, projectName: client.dockerProjectName,
      onTick: async summary => {
        await renewLease(jobId)
        if (!summary.ready) {
          logLine('debug', 'health tick',
            { rows: summary.rows.map(r => `${r.Name}=${r.State}/${r.Health || 'no-hc'}`) })
        }
      },
    })
    await persistLog({ jobId, step: currentStep, level: 'success',
      message: 'Todos los contenedores healthy' })

    // ── RUNNING_MIGRATIONS ───────────────────────────────
    currentStep = 'RUNNING_MIGRATIONS'
    await bumpJobStep(jobId, currentStep, tick())
    const plan = migrationPlanFor(client.productType)
    if (!plan) {
      await persistLog({ jobId, step: currentStep, level: 'info',
        message: `Producto ${client.productType} no tiene plan de migraciones definido — salteado` })
    } else {
      for (const cmd of plan.commands) {
        try {
          const r = await composeExec(composePath, envPath, client.dockerProjectName, plan.service, cmd)
          await persistLog({ jobId, step: currentStep, level: 'success',
            message: `migración OK: ${cmd.join(' ')}`,
            metadata: { stdoutTail: r.stdout.slice(-400) } })
        } catch (e) {
          const err = e as DockerError
          await persistLog({ jobId, step: currentStep, level: 'error',
            message: `migración falló: ${cmd.join(' ')}`,
            metadata: { stderr: err.stderr?.slice(0, 600) } })
          if (plan.failFast) throw e
        }
      }
    }

    // ── VERIFYING_ENDPOINT ───────────────────────────────
    currentStep = 'VERIFYING_ENDPOINT'
    await bumpJobStep(jobId, currentStep, tick())
    const verifyOk = await tryHttpProbe(`https://${client.crmDomain}/`, 10000)
    if (verifyOk) {
      await persistLog({ jobId, step: currentStep, level: 'success',
        message: `CRM responde en https://${client.crmDomain}/` })
    } else {
      // No hacemos fallar: puede ser que el DNS apenas se esté propagando
      // o que Traefik todavía no haya emitido el certificado.
      await persistLog({ jobId, step: currentStep, level: 'warn',
        message: `No se pudo verificar https://${client.crmDomain}/ — revisar DNS y Traefik` })
    }

    // ── FINALIZADO ───────────────────────────────────────
    currentStep = 'FINALIZADO'
    await bumpJobStep(jobId, currentStep, tick())
    await db.collection(COL.clients).doc(job.clientTenantId).update({
      status:    'activo' satisfies ClientStatus,
      updatedAt: FieldValue.serverTimestamp(),
    })
    await persistLog({ jobId, step: currentStep, level: 'success',
      message: 'Stack del cliente operativo' })
    await finishJob(jobId, 'COMPLETADO')
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await persistLog({ jobId, step: currentStep, level: 'error',
      message: `Falló en ${currentStep}: ${message}` })

    // Cleanup seguro: sólo antes de STARTING_STACK
    if (canCleanupAt(currentStep)) {
      await persistLog({ jobId, step: currentStep, level: 'warn',
        message: `Cleanup automático: borrando ${client.folderPath} (nada se había arrancado todavía)` })
      try {
        if (await folderExists(client.folderPath)) {
          await removeFolder(client.folderPath)
        }
      } catch (cleanupErr) {
        await persistLog({ jobId, step: currentStep, level: 'error',
          message: `Cleanup parcial: ${(cleanupErr as Error).message}` })
      }
    } else {
      await persistLog({ jobId, step: currentStep, level: 'warn',
        message:
          'Fallo después de iniciar contenedores — no se ejecuta cleanup automático. ' +
          'Revisá con: docker compose -f ' + composePath + ' ps' })
    }

    await db.collection(COL.clients).doc(job.clientTenantId).update({
      status:    'error' satisfies ClientStatus,
      updatedAt: FieldValue.serverTimestamp(),
    })
    await finishJob(jobId, 'ERROR', message)
  }
}

function canCleanupAt(step: JobStep): boolean {
  const idx = WORKER_STEPS.indexOf(step)
  const cutoff = WORKER_STEPS.indexOf(CLEANUP_CUTOFF)
  // Permitimos cleanup si el fallo fue ANTES del cutoff (no inclusive).
  return idx >= 0 && idx < cutoff
}

async function failNoCleanup(jobId: string, step: JobStep, message: string): Promise<void> {
  await persistLog({ jobId, step, level: 'error', message })
  await finishJob(jobId, 'ERROR', message)
}

async function tryHttpProbe(url: string, timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctrl.signal })
    return res.status > 0 && res.status < 600
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}
