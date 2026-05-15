'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner } from '@/components/ui'
import { useRequireSuperAdmin } from '@/lib/hooks/useRequireSuperAdmin'
import { provisioningApi } from '@/lib/provisioning/client'
import { StatusBadge } from '@/components/provisioning/StatusBadge'
import { toDate } from '@/lib/utils'
import type {
  ClientBackupConfig, ClientDomain, ClientIntegration,
  ClientInitialUser, ClientTenant, ClientWorkflow,
} from '@/types/provisioning'
import {
  ExternalLink, AlertTriangle, Play, Square, RotateCw, Database, FileText,
  Workflow, Boxes, Users, Plug, ShieldCheck, Server,
} from 'lucide-react'

interface State {
  client:       ClientTenant
  domains:      ClientDomain[]
  integrations: ClientIntegration[]
  users:        ClientInitialUser[]
  workflows:    ClientWorkflow[]
  backup:       ClientBackupConfig | null
}

export default function ClienteDetallePage() {
  const params = useParams<{ id: string }>()
  const { ready } = useRequireSuperAdmin()
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string; ssh?: string } | null>(null)

  const load = useCallback(async () => {
    if (!ready || !params?.id) return
    try {
      const data = await provisioningApi.getClient(params.id)
      setState(data)
    } catch (e) { setError((e as Error).message) }
  }, [ready, params?.id])

  useEffect(() => { load() }, [load])

  async function doAction(action: 'start' | 'stop' | 'restart' | 'backup') {
    if (!params?.id) return
    setActionMsg(null)
    const r = await provisioningApi.clientAction(params.id, action)
    if (r.ok) {
      setActionMsg({ kind: 'ok', text: 'Acción ejecutada' })
      load()
    } else {
      setActionMsg({ kind: 'warn', text: r.message ?? 'Acción no disponible', ssh: r.sshCommand })
    }
  }

  if (!ready) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={24} /></div>
  if (error) {
    return (
      <div>
        <PageHeader title="Cliente" />
        <div className="m-4 md:m-8 p-3 rounded-lg border border-flux-danger/40 bg-flux-danger/10 text-xs text-flux-danger flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      </div>
    )
  }
  if (!state) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={20} /></div>

  const { client, domains, integrations, users, workflows, backup } = state

  return (
    <div>
      <PageHeader
        title={client.name}
        subtitle={`${client.slug} · ${client.productType} · v${client.templateVersion}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={client.status} />
            <a href={`https://${client.crmDomain}`} target="_blank" rel="noopener"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-flux-border text-flux-text2 hover:bg-white/5 inline-flex items-center gap-1">
              Abrir CRM <ExternalLink size={12} />
            </a>
            <a href={`https://${client.n8nDomain}`} target="_blank" rel="noopener"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-flux-border text-flux-text2 hover:bg-white/5 inline-flex items-center gap-1">
              Abrir n8n <ExternalLink size={12} />
            </a>
            <a href={`/api/provisioning/clients/${client.id}/files`} target="_blank"
              className="px-2.5 py-1.5 text-xs rounded-lg border border-flux-border text-flux-text2 hover:bg-white/5 inline-flex items-center gap-1">
              <FileText size={12} /> Archivos
            </a>
          </div>
        }
      />

      <div className="p-4 md:p-8 space-y-5">
        {/* Acciones */}
        <Card title="Acciones administrativas" icon={<ShieldCheck size={14}/>}>
          <div className="flex flex-wrap gap-2">
            <ActionBtn icon={<Play size={12}/>}   label="Iniciar stack"   onClick={() => doAction('start')} />
            <ActionBtn icon={<Square size={12}/>} label="Detener stack"   onClick={() => doAction('stop')}  destructive />
            <ActionBtn icon={<RotateCw size={12}/>} label="Reiniciar"     onClick={() => doAction('restart')} />
            <ActionBtn icon={<Database size={12}/>} label="Backup manual" onClick={() => doAction('backup')} />
          </div>
          {actionMsg && (
            <div className={`mt-3 p-2 rounded-lg text-xs ${
              actionMsg.kind === 'ok'   ? 'bg-flux-success/10 text-flux-success border border-flux-success/40' :
              actionMsg.kind === 'warn' ? 'bg-flux-warning/10 text-flux-warning border border-flux-warning/40' :
                                          'bg-flux-danger/10 text-flux-danger border border-flux-danger/40'
            }`}>
              {actionMsg.text}
              {actionMsg.ssh && (
                <pre className="mt-2 text-2xs font-mono whitespace-pre-wrap text-flux-text2">{actionMsg.ssh}</pre>
              )}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="Identidad" icon={<Boxes size={14}/>}>
            <Row k="Slug"      v={client.slug} mono />
            <Row k="Producto"  v={`${client.productType} (v${client.templateVersion})`} />
            <Row k="Modo"      v={client.mode} />
            <Row k="Estado"    v={<StatusBadge status={client.status} />} />
            <Row k="Creado"    v={format(toDate(client.createdAt as any), "dd MMM yyyy HH:mm", { locale: es })} />
            <Row k="Creado por" v={client.createdByName ?? client.createdById} />
          </Card>

          <Card title="Contenedores y rutas" icon={<Server size={14}/>}>
            <Row k="Project"    v={client.dockerProjectName} mono />
            <Row k="Postgres"   v={client.postgresContainer} mono />
            <Row k="API"        v={client.apiContainer} mono />
            <Row k="App"        v={client.appContainer} mono />
            <Row k="n8n"        v={client.n8nContainer} mono />
            <Row k="Folder"     v={client.folderPath} mono />
            <Row k="Backups"    v={client.backupPath} mono />
          </Card>

          <Card title="Dominios">
            {domains.length === 0
              ? <p className="text-xs text-flux-text3">Sin dominios registrados.</p>
              : domains.map(d => (
                <div key={d.id} className="flex items-center justify-between py-1.5 text-xs border-b border-flux-border last:border-0">
                  <div>
                    <span className="text-2xs text-flux-text3 uppercase block">{d.type}</span>
                    <span className="text-flux-text1 font-mono">{d.domain}</span>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              ))}
          </Card>

          <Card title="Base de datos" icon={<Database size={14}/>}>
            <Row k="DB"        v={client.postgresDb} mono />
            <Row k="Usuario"   v={client.postgresUser} mono />
            <Row k="Container" v={client.postgresContainer} mono />
          </Card>

          <Card title="Integraciones" icon={<Plug size={14}/>}>
            {integrations.length === 0
              ? <p className="text-xs text-flux-text3">No hay integraciones registradas.</p>
              : integrations.map(i => (
                <div key={i.id} className="flex items-center justify-between py-1 text-xs">
                  <span className="text-flux-text2">{i.type}</span>
                  <StatusBadge status={i.status} />
                </div>
              ))}
          </Card>

          <Card title="Backups">
            {backup ? (
              <>
                <Row k="Estado"     v={<StatusBadge status={backup.status} />} />
                <Row k="Frecuencia" v={backup.frequency} />
                <Row k="Path"       v={backup.backupPath} mono />
                <Row k="Último"     v={backup.lastBackupAt ? format(toDate(backup.lastBackupAt as any), 'dd MMM yyyy HH:mm', { locale: es }) : '—'} />
              </>
            ) : <p className="text-xs text-flux-text3">Sin backup configurado.</p>}
          </Card>

          <Card title="Usuarios iniciales" icon={<Users size={14}/>}>
            {users.length === 0
              ? <p className="text-xs text-flux-text3">Sin usuarios.</p>
              : users.map(u => (
                <div key={u.id} className="flex items-center justify-between py-1.5 text-xs border-b border-flux-border last:border-0">
                  <div>
                    <span className="text-flux-text1">{u.nombre}</span>
                    <span className="text-2xs text-flux-text3 block">{u.email} · {u.role}{u.isDemo ? ' · demo' : ''}</span>
                  </div>
                  {u.mustChangePassword && <span className="text-2xs text-flux-warning">Cambio req.</span>}
                </div>
              ))}
          </Card>

          <Card title="Workflows" icon={<Workflow size={14}/>}>
            {workflows.length === 0
              ? <p className="text-xs text-flux-text3">Sin workflows.</p>
              : (
                <div className="grid grid-cols-1 gap-1">
                  {workflows.map(w => (
                    <div key={w.id} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-flux-text2">{w.displayName}</span>
                      <StatusBadge status={w.status} />
                    </div>
                  ))}
                </div>
              )}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────
function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="p-4 rounded-xl border border-flux-border bg-flux-surface">
      <h3 className="text-2xs font-medium uppercase tracking-widest text-flux-text3 flex items-center gap-2 mb-2">
        {icon}{title}
      </h3>
      {children}
    </section>
  )
}
function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1 text-xs">
      <dt className="text-flux-text3">{k}</dt>
      <dd className={`text-flux-text1 truncate ${mono ? 'font-mono text-2xs' : ''}`}>{v}</dd>
    </div>
  )
}
function ActionBtn({ icon, label, onClick, destructive }: { icon?: React.ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border ${
        destructive
          ? 'border-flux-danger/40 text-flux-danger hover:bg-flux-danger/10'
          : 'border-flux-border text-flux-text2 hover:bg-white/5'
      }`}>
      {icon}{label}
    </button>
  )
}
