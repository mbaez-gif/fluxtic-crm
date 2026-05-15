import { db, FieldValue } from './firebase.js'
import { COL, config } from './config.js'
import type { JobStep, LogLevel } from './types.js'

export function logLine(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const head = `[${ts}] ${level.padEnd(7)} ${msg}`
  if (level === 'error') {
    console.error(head, meta ?? '')
  } else if (level === 'warn') {
    console.warn(head, meta ?? '')
  } else {
    console.log(head, meta ?? '')
  }
}

// Escribe un log persistente asociado al job. No bloquea el flujo si Firestore
// está lento — los errores se reportan a stdout para journalctl.
export async function persistLog(opts: {
  jobId:    string
  step:     JobStep
  level:    LogLevel
  message:  string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const safeMeta = sanitizeMetadata(opts.metadata)
  logLine(opts.level, `[${opts.step}] ${opts.message}`, safeMeta)
  try {
    await db.collection(COL.logs).add({
      jobId:     opts.jobId,
      step:      opts.step,
      level:     opts.level,
      message:   opts.message,
      metadata:  safeMeta ?? null,
      workerId:  config.workerId,
      createdAt: FieldValue.serverTimestamp(),
    })
  } catch (e) {
    console.error('[provisioner] failed to persist log', e)
  }
}

// Defensa anti-leak: nunca persistir cosas que parezcan secretos.
// Lista negra de claves comunes. Si aparecen, se reemplaza el valor.
const SECRET_KEY_RE = /password|secret|token|key|credential/i
function sanitizeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (SECRET_KEY_RE.test(k)) out[k] = '[redacted]'
    else if (typeof v === 'string' && v.length > 1000) out[k] = v.slice(0, 1000) + '…'
    else out[k] = v
  }
  return out
}
