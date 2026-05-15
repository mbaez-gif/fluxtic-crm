'use client'

import { auth } from '@/lib/firebase/config'
import type {
  ClientBackupConfig,
  ClientDomain,
  ClientIntegration,
  ClientInitialUser,
  ClientTenant,
  ClientWorkflow,
  CreateClientPayload,
  CreateClientResponse,
  JobWithCounts,
  ProductMetadata,
  ProvisioningLog,
} from '@/types/provisioning'

async function authHeader(): Promise<Record<string, string>> {
  const u = auth.currentUser
  if (!u) throw new Error('No hay usuario autenticado')
  const token = await u.getIdToken()
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
}

async function call<T>(input: string, init: RequestInit = {}): Promise<T> {
  const headers = await authHeader()
  const res = await fetch(input, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
    cache:   'no-store',
  })
  if (!res.ok) {
    let detail: unknown = null
    try { detail = await res.json() } catch { /* ignore */ }
    const msg = (detail as { message?: string; error?: string })?.message
      ?? (detail as { error?: string })?.error
      ?? `HTTP ${res.status}`
    const err = new Error(msg) as Error & { status?: number; detail?: unknown }
    err.status = res.status
    err.detail = detail
    throw err
  }
  return res.json() as Promise<T>
}

// ── API ───────────────────────────────────────────────────
export const provisioningApi = {
  async listProducts(): Promise<ProductMetadata[]> {
    const r = await call<{ products: ProductMetadata[] }>('/api/provisioning/products')
    return r.products
  },

  async validateSlug(slug: string): Promise<{ available: boolean; reason?: string }> {
    return call<{ available: boolean; reason?: string }>('/api/provisioning/validate-slug', {
      method: 'POST',
      body:   JSON.stringify({ slug }),
    })
  },

  async validateDomain(domain: string): Promise<{ available: boolean; reason?: string }> {
    return call<{ available: boolean; reason?: string }>('/api/provisioning/validate-domain', {
      method: 'POST',
      body:   JSON.stringify({ domain }),
    })
  },

  async createClient(payload: CreateClientPayload): Promise<CreateClientResponse> {
    return call<CreateClientResponse>('/api/provisioning/clients', {
      method: 'POST',
      body:   JSON.stringify(payload),
    })
  },

  async listClients(): Promise<ClientTenant[]> {
    const r = await call<{ clients: ClientTenant[] }>('/api/provisioning/clients')
    return r.clients
  },

  async getClient(id: string): Promise<{
    client:       ClientTenant
    domains:      ClientDomain[]
    integrations: ClientIntegration[]
    users:        ClientInitialUser[]
    workflows:    ClientWorkflow[]
    backup:       ClientBackupConfig | null
  }> {
    return call(`/api/provisioning/clients/${id}`)
  },

  async getJob(id: string): Promise<JobWithCounts> {
    const r = await call<{ job: JobWithCounts }>(`/api/provisioning/jobs/${id}`)
    return r.job
  },

  async getJobLogs(id: string): Promise<ProvisioningLog[]> {
    const r = await call<{ logs: ProvisioningLog[] }>(`/api/provisioning/jobs/${id}/logs`)
    return r.logs
  },

  async getFiles(id: string): Promise<{ envFile: string; composeFile: string; metadataJson: string; alreadyRevealed: boolean }> {
    return call(`/api/provisioning/clients/${id}/files`)
  },

  // Acciones de manage (V1 devuelven 501 + sshCommand)
  async clientAction(id: string, action: 'start' | 'stop' | 'restart' | 'backup'): Promise<{
    ok: boolean; error?: string; message?: string; sshCommand?: string
  }> {
    try {
      return await call(`/api/provisioning/clients/${id}/${action}`, { method: 'POST' })
    } catch (e) {
      const detail = (e as Error & { detail?: { message?: string; sshCommand?: string } }).detail
      return {
        ok:         false,
        error:      'NOT_IMPLEMENTED_V1',
        message:    detail?.message ?? (e as Error).message,
        sshCommand: detail?.sshCommand,
      }
    }
  },
}
