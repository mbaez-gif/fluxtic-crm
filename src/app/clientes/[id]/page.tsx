'use client'

import { useDocument }   from '@/lib/hooks/useDocument'
import { useCollection } from '@/lib/hooks/useCollection'
import { Badge, Spinner, EmptyState } from '@/components/ui'
import { PageHeader }    from '@/components/layout/PageHeader'
import type { Cliente, Proyecto, Abono } from '@/types'
import { format }        from 'date-fns'
import { es }            from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'
import Link              from 'next/link'
import {
  ArrowLeft, Mail, Building2,
  FolderKanban, CreditCard, ExternalLink,
} from 'lucide-react'

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

export default function ClienteDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { id } = params
  const { data: cliente,   loading: lc } = useDocument<Cliente>('clientes', id)
  const { data: proyectos, loading: lp } = useCollection<Proyecto>('proyectos', {
    filters: [{ field: 'clienteId', op: '==', value: id }],
  })
  const { data: abonos, loading: la } = useCollection<Abono>('abonos', {
    filters: [{ field: 'clienteId', op: '==', value: id }],
  })

  if (lc || lp || la) return (
    <div className="flex items-center justify-center min-h-screen"><Spinner size={24} /></div>
  )

  if (!cliente) return (
    <div className="px-8 py-20">
      <EmptyState title="Cliente no encontrado" description="El cliente puede haber sido eliminado." />
    </div>
  )

  const mrr = abonos.filter(a => a.estado === 'activo').reduce((acc, a) => {
    if (a.periodicidad === 'mensual')    return acc + a.monto
    if (a.periodicidad === 'trimestral') return acc + a.monto / 3
    return acc + a.monto / 12
  }, 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={cliente.empresa}
        subtitle={`${cliente.nombre} · ${cliente.sector ?? 'Sin sector'}`}
        actions={
          <Link href="/clientes" className="btn-ghost flex items-center gap-2 text-sm">
            <ArrowLeft size={14} /> Volver
          </Link>
        }
      />
      <div className="px-8 pb-10 space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div className="flux-card text-center">
            <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">Proyectos activos</p>
            <p className="font-display text-2xl font-bold text-flux-white">{proyectos.filter(p => p.estado === 'activo').length}</p>
          </div>
          <div className="flux-card text-center">
            <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">Abonos activos</p>
            <p className="font-display text-2xl font-bold text-flux-white">{abonos.filter(a => a.estado === 'activo').length}</p>
          </div>
          <div className="flux-card text-center">
            <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">MRR</p>
            <p className="font-display text-2xl font-bold text-flux-teal">€{Math.round(mrr).toLocaleString('es-ES')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="flux-card">
              <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-4">Información</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={13} className="text-flux-text3 shrink-0" />
                  <a href={`mailto:${cliente.email}`} className="text-flux-teal hover:underline">{cliente.email}</a>
                </div>
                {cliente.sector && (
                  <div className="flex items-center gap-2 text-sm text-flux-text2">
                    <Building2 size={13} className="text-flux-text3 shrink-0" />{cliente.sector}
                  </div>
                )}
                <Badge variant={cliente.estado === 'activo' ? 'teal' : cliente.estado === 'churned' ? 'danger' : 'default'}>
                  {cliente.estado}
                </Badge>
                <p className="text-2xs text-flux-text3">
                  Cliente desde {format(toDate(cliente.creadoEn), "MMMM yyyy", { locale: es })}
                </p>
              </div>
            </div>
            <div className="flux-card">
              <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-4">
                Contactos ({cliente.contactos?.length ?? 0})
              </h2>
              {(!cliente.contactos || cliente.contactos.length === 0) ? (
                <p className="text-xs text-flux-text3">Sin contactos registrados</p>
              ) : (
                <div className="space-y-3">
                  {cliente.contactos.map((c, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-flux-muted flex items-center justify-center text-2xs font-medium text-flux-teal shrink-0">
                        {c.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-flux-text1">{c.nombre}</p>
                        {c.cargo && <p className="text-2xs text-flux-text3">{c.cargo}</p>}
                        <a href={`mailto:${c.email}`} className="text-2xs text-flux-teal hover:underline">{c.email}</a>
                        {c.telefono && <p className="text-2xs text-flux-text3">{c.telefono}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-2 space-y-4">
            <div className="flux-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest flex items-center gap-2">
                  <FolderKanban size={13} /> Proyectos
                </h2>
                <Link href="/proyectos" className="text-xs text-flux-teal hover:underline flex items-center gap-1">
                  Ver todos <ExternalLink size={10} />
                </Link>
              </div>
              {proyectos.length === 0 ? (
                <p className="text-xs text-flux-text3">Sin proyectos. <Link href="/proyectos" className="text-flux-teal hover:underline">Crear uno</Link></p>
              ) : (
                <div className="space-y-2">
                  {proyectos.map(p => (
                    <Link key={p.id} href={`/proyectos/${p.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-flux-muted transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-flux-text1 group-hover:text-flux-white truncate">{p.nombre}</p>
                        <p className="text-2xs text-flux-text3">
                          {format(toDate(p.fechaInicio), "d MMM yyyy", { locale: es })}
                          {p.fechaFin ? ` → ${format(toDate(p.fechaFin), "d MMM yyyy", { locale: es })}` : ' · En curso'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={p.estado === 'activo' ? 'teal' : p.estado === 'completado' ? 'default' : 'warning'}>{p.estado}</Badge>
                        <p className="text-2xs text-flux-teal mt-1">€{p.presupuesto.toLocaleString('es-ES')}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="flux-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest flex items-center gap-2">
                  <CreditCard size={13} /> Abonos
                </h2>
                <Link href="/abonos" className="text-xs text-flux-teal hover:underline flex items-center gap-1">
                  Ver todos <ExternalLink size={10} />
                </Link>
              </div>
              {abonos.length === 0 ? (
                <p className="text-xs text-flux-text3">Sin abonos. <Link href="/abonos" className="text-flux-teal hover:underline">Crear uno</Link></p>
              ) : (
                <div className="space-y-2">
                  {abonos.map(a => (
                    <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-flux-surface border border-flux-border/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-flux-text1 truncate">{a.nombre}</p>
                        <p className="text-2xs text-flux-text3 capitalize">
                          {a.periodicidad} · próx. {format(toDate(a.fechaRenovacion), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant={a.estado === 'activo' ? 'teal' : a.estado === 'cancelado' ? 'danger' : 'warning'}>{a.estado}</Badge>
                        <p className="text-2xs text-flux-teal mt-1">€{a.monto.toLocaleString('es-ES')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
