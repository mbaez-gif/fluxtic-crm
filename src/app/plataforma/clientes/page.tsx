'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PageHeader } from '@/components/layout/PageHeader'
import { Spinner, EmptyState } from '@/components/ui'
import { useRequireSuperAdmin } from '@/lib/hooks/useRequireSuperAdmin'
import { provisioningApi } from '@/lib/provisioning/client'
import { StatusBadge } from '@/components/provisioning/StatusBadge'
import { toDate } from '@/lib/utils'
import type { ClientTenant } from '@/types/provisioning'
import { Boxes, Plus, ExternalLink, AlertTriangle } from 'lucide-react'

export default function ClientesFluxticPage() {
  const { ready } = useRequireSuperAdmin()
  const [clients, setClients] = useState<ClientTenant[] | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    provisioningApi.listClients()
      .then(setClients)
      .catch(e => setError(e.message))
  }, [ready])

  if (!ready) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size={24} /></div>

  return (
    <div>
      <PageHeader
        title="Clientes Fluxtic"
        subtitle="Consola interna de provisionamiento"
        actions={
          <Link href="/plataforma/clientes/nuevo"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-flux-teal text-[#0a0d12] font-medium hover:bg-flux-tealDim">
            <Plus size={14} /> Nuevo cliente
          </Link>
        }
      />
      {error && (
        <div className="m-4 md:m-8 p-3 rounded-lg border border-flux-danger/40 bg-flux-danger/10 text-xs text-flux-danger flex items-center gap-2">
          <AlertTriangle size={14} /> {error}
        </div>
      )}
      <div className="p-4 md:p-8">
        {clients == null ? (
          <div className="flex items-center justify-center py-16"><Spinner size={20} /></div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<Boxes size={36} />}
            title="Todavía no hay clientes Fluxtic"
            description="Cuando crees el primero va a aparecer acá con su estado y URLs."
            action={
              <Link href="/plataforma/clientes/nuevo"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-flux-teal text-[#0a0d12] font-medium hover:bg-flux-tealDim">
                <Plus size={14} /> Crear cliente
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-flux-border bg-flux-surface">
            <table className="w-full text-sm">
              <thead className="bg-flux-bg/40 text-2xs uppercase tracking-widest text-flux-text3">
                <tr>
                  <Th>Cliente</Th>
                  <Th>Producto</Th>
                  <Th>Modo</Th>
                  <Th>Estado</Th>
                  <Th>CRM</Th>
                  <Th>n8n</Th>
                  <Th>Creado</Th>
                  <Th />
                </tr>
              </thead>
              <tbody className="divide-y divide-flux-border">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <Td>
                      <Link href={`/plataforma/clientes/${c.id}`} className="font-medium text-flux-white hover:text-flux-teal">
                        {c.name}
                      </Link>
                      <p className="text-2xs text-flux-text3 font-mono">{c.slug}</p>
                    </Td>
                    <Td><span className="capitalize">{c.productType}</span></Td>
                    <Td><span className="capitalize">{c.mode}</span></Td>
                    <Td><StatusBadge status={c.status} /></Td>
                    <Td>
                      <a href={`https://${c.crmDomain}`} target="_blank" rel="noopener"
                        className="inline-flex items-center gap-1 text-flux-text2 hover:text-flux-teal text-xs">
                        {c.crmDomain} <ExternalLink size={10} />
                      </a>
                    </Td>
                    <Td>
                      <a href={`https://${c.n8nDomain}`} target="_blank" rel="noopener"
                        className="inline-flex items-center gap-1 text-flux-text2 hover:text-flux-teal text-xs">
                        {c.n8nDomain} <ExternalLink size={10} />
                      </a>
                    </Td>
                    <Td>
                      <span className="text-2xs text-flux-text3">
                        {format(toDate(c.createdAt as any), 'dd MMM yy', { locale: es })}
                      </span>
                    </Td>
                    <Td>
                      <Link href={`/plataforma/clientes/${c.id}`}
                        className="text-xs text-flux-teal hover:underline">
                        Ver
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2.5">{children}</th>
}
function Td({ children }: { children?: React.ReactNode }) {
  return <td className="px-3 py-2.5 align-middle">{children}</td>
}
