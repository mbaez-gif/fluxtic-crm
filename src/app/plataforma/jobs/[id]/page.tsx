'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui'
import { useRequireSuperAdmin } from '@/lib/hooks/useRequireSuperAdmin'
import { provisioningApi } from '@/lib/provisioning/client'
import { StatusBadge } from '@/components/provisioning/StatusBadge'
import { toDate, cn } from '@/lib/utils'
import type { JobWithCounts, ProvisioningLog, LogLevel } from '@/types/provisioning'
import { AlertTriangle } from 'lucide-react'

const LEVEL_COLOR: Record<LogLevel, string> = {
  info:    'text-flux-info',
  warn:    'text-flux-warning',
  error:   'text-flux-danger',
  success: 'text-flux-success',
  debug:   'text-flux-text3',
}

export default function JobDetallePage() {
  const params = useParams<{ id: string }>()
  const { ready } = useRequireSuperAdmin()
  const [job,  setJob]  = useState<JobWithCounts | null>(null)
  const [logs, setLogs] = useState<ProvisioningLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!ready || !params?.id) return
    try {
      const [j, l] = await Promise.all([
        provisioningApi.getJob(params.id),
        provisioningApi.getJobLogs(params.id),
      ])
      setJob(j)
      setLogs(l)
    } catch (e) { setError((e as Error).message) }
  }, [ready, params?.id])

  useEffect(() => { load() }, [load])

  // V1: el job se completa en una sola request POST a /clients, así que
  // el polling es defensivo. Si el job todavía está EN_PROCESO seguimos
  // pidiendo. Esto cubre futuras versiones con worker asincrónico.
  useEffect(() => {
    if (!job) return
    if (job.status !== 'EN_PROCESO' && job.status !== 'PENDIENTE') return
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [job, load])

  if (!ready) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={24}/></div>
  if (error)  return (
    <div>
      <PageHeader title="Job de provisionamiento" />
      <div className="m-4 md:m-8 p-3 rounded-lg border border-flux-danger/40 bg-flux-danger/10 text-xs text-flux-danger flex items-center gap-2">
        <AlertTriangle size={14}/> {error}
      </div>
    </div>
  )
  if (!job) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={20}/></div>

  return (
    <div>
      <PageHeader
        title="Job de provisionamiento"
        subtitle={`Cliente ${job.clientTenantId}`}
        actions={<StatusBadge status={job.status} />}
      />
      <div className="p-4 md:p-8 space-y-4">
        <div className="p-4 rounded-xl border border-flux-border bg-flux-surface">
          <div className="flex items-center justify-between text-xs text-flux-text2 mb-2">
            <span>Paso actual: {job.currentStep ?? '—'}</span>
            <span>{job.completedSteps}/{job.totalSteps} ({job.progressPct}%)</span>
          </div>
          <div className="w-full h-2 rounded-full bg-flux-muted overflow-hidden">
            <div className="h-full bg-flux-teal transition-all" style={{ width: `${job.progressPct}%` }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-2xs text-flux-text3">
            <Meta k="Inicio"  v={job.startedAt  ? format(toDate(job.startedAt  as any), 'dd MMM HH:mm:ss', { locale: es }) : '—'} />
            <Meta k="Fin"     v={job.finishedAt ? format(toDate(job.finishedAt as any), 'dd MMM HH:mm:ss', { locale: es }) : '—'} />
            <Meta k="Por"     v={job.createdByName ?? job.createdById} />
            <Meta k="Error"   v={job.errorMessage ?? '—'} />
          </div>
        </div>

        <div className="rounded-xl border border-flux-border bg-flux-surface overflow-hidden">
          <header className="px-3 py-2 border-b border-flux-border text-2xs font-medium uppercase tracking-widest text-flux-text3">
            Logs ({logs.length})
          </header>
          {logs.length === 0 ? (
            <p className="p-4 text-xs text-flux-text3">Sin logs aún.</p>
          ) : (
            <ol className="divide-y divide-flux-border">
              {logs.map(l => {
                const open = expanded.has(l.id)
                return (
                  <li key={l.id} className="px-3 py-2 text-xs">
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xs text-flux-text3 font-mono shrink-0">
                        {format(toDate(l.createdAt as any), 'HH:mm:ss')}
                      </span>
                      <span className={cn('uppercase text-2xs font-medium shrink-0', LEVEL_COLOR[l.level])}>{l.level}</span>
                      <span className="text-2xs text-flux-text3 shrink-0">{l.step}</span>
                      <span className="text-flux-text1 flex-1">{l.message}</span>
                      {l.metadata && (
                        <button onClick={() => {
                          setExpanded(s => {
                            const c = new Set(s); c.has(l.id) ? c.delete(l.id) : c.add(l.id); return c
                          })
                        }} className="text-2xs text-flux-text3 hover:text-flux-text1">
                          {open ? 'ocultar' : 'detalle'}
                        </button>
                      )}
                    </div>
                    {open && l.metadata && (
                      <pre className="mt-1 ml-16 p-2 rounded bg-flux-bg text-2xs font-mono text-flux-text2 overflow-x-auto">
                        {JSON.stringify(l.metadata, null, 2)}
                      </pre>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <p className="uppercase tracking-widest">{k}</p>
      <p className="text-flux-text1 mt-0.5 truncate">{v}</p>
    </div>
  )
}
