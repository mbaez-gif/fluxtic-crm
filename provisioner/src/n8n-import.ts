// Import de workflows n8n al instance recién levantada del cliente.
// "Best effort": si no hay JSONs en /opt/fluxtic/templates/<producto>/workflows/
// el paso se salta con un log informativo (no rompe el job).

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { db, FieldValue } from './firebase.js'
import { COL } from './config.js'
import type { ProductType } from './types.js'

const TEMPLATES_ROOT = process.env.TEMPLATES_ROOT ?? '/opt/fluxtic/templates'

export interface ImportResult {
  imported:  number
  skipped:   number
  failed:    number
  total:     number
  details:   Array<{ name: string; status: 'ok' | 'skipped' | 'failed'; error?: string }>
}

export async function importWorkflows(opts: {
  product:        ProductType
  n8nDomain:      string
  n8nUser:        string
  n8nPassword:    string
  clientTenantId: string
}): Promise<ImportResult> {
  const dir = path.join(TEMPLATES_ROOT, opts.product, 'workflows')

  const files = await listJsonFiles(dir)
  const result: ImportResult = {
    imported: 0, skipped: 0, failed: 0, total: files.length, details: [],
  }
  if (files.length === 0) return result

  const auth = 'Basic ' + Buffer.from(`${opts.n8nUser}:${opts.n8nPassword}`).toString('base64')

  for (const file of files) {
    const filename = path.basename(file)
    try {
      const raw = await fs.readFile(file, 'utf-8')
      const wf = JSON.parse(raw) as Record<string, unknown>
      if (typeof wf !== 'object' || wf === null) {
        result.skipped++
        result.details.push({ name: filename, status: 'skipped', error: 'no es objeto' })
        continue
      }
      // El campo `active` se ignora: el estado inicial viene del wizard.
      // Limpiamos campos que n8n no acepta en la creación.
      delete wf.active
      delete wf.id
      delete wf.tags
      delete wf.versionId

      const res = await postWithTimeout(
        `https://${opts.n8nDomain}/rest/workflows`,
        { method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify(wf) },
        15000,
      )

      if (res.status === 200 || res.status === 201) {
        const body = await safeJson(res)
        const newId = extractWorkflowId(body)
        await updateClientWorkflow(opts.clientTenantId, wfNameFrom(wf, filename), newId)
        result.imported++
        result.details.push({ name: filename, status: 'ok' })
      } else {
        const text = await res.text().catch(() => '')
        result.failed++
        result.details.push({
          name: filename, status: 'failed',
          error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        })
      }
    } catch (e) {
      result.failed++
      result.details.push({
        name: filename, status: 'failed',
        error: (e as Error).message,
      })
    }
  }
  return result
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.json'))
      .map(e => path.join(dir, e.name))
      .sort()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw e
  }
}

function wfNameFrom(wf: Record<string, unknown>, filename: string): string {
  if (typeof wf.name === 'string') return wf.name
  return path.basename(filename, '.json')
}

function extractWorkflowId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const data = (body as { data?: { id?: unknown }; id?: unknown })
  const candidate = data.data?.id ?? data.id
  return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : null
}

async function safeJson(res: Response): Promise<unknown> {
  try { return await res.json() } catch { return null }
}

async function postWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

async function updateClientWorkflow(
  clientTenantId: string,
  workflowName:   string,
  n8nWorkflowId:  string | null,
): Promise<void> {
  const snap = await db.collection(COL.workflows)
    .where('clientTenantId', '==', clientTenantId)
    .where('name', '==', workflowName)
    .limit(1)
    .get()
  if (snap.empty) return
  const doc = snap.docs[0]
  if (!doc) return
  await doc.ref.update({
    n8nWorkflowId,
    updatedAt: FieldValue.serverTimestamp(),
  })
}

// Parser simple de .env (KEY=value, ignora # y líneas vacías, soporta
// comillas simples/dobles). No maneja multilínea — el .env del cliente
// no las tiene.
export function parseEnv(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}
