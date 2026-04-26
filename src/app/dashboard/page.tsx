'use client'

import { useAuthContext }  from '@/components/auth/AuthProvider'
import { useCollection }   from '@/lib/hooks/useCollection'
import { PageHeader }      from '@/components/layout/PageHeader'
import { StatCard, Badge, Spinner } from '@/components/ui'
import type { Lead, Oportunidad, Proyecto, Abono, Tarea } from '@/types'
import {
  Users, TrendingUp, FolderKanban, CreditCard,
  AlertTriangle, ArrowRight,
} from 'lucide-react'
import Link    from 'next/link'
import { cn }  from '@/lib/utils'
import { format, isAfter, addDays } from 'date-fns'
import { es }  from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date()
}

const LEAD_ESTADO: Record<string, 'default' | 'teal' | 'info' | 'danger'> = {
  nuevo: 'default', contactado: 'info', calificado: 'teal', descartado: 'danger',
}

const ETAPA_LABEL: Record<string, string> = {
  analisis: 'Análisis', propuesta: 'Propuesta',
  negociacion: 'Negociación', ganada: 'Ganada', perdida: 'Perdida',
}

export default function DashboardPage() {
  const { profile } = useAuthContext()

  const { data: leads,     loading: l1 } = useCollection<Lead>('leads')
  const { data: opor,      loading: l2 } = useCollection<Oportunidad>('oportunidades')
  const { data: proyectos, loading: l3 } = useCollection<Proyecto>('proyectos')
  const { data: abonos,    loading: l4 } = useCollection<Abono>('abonos')
  const { data: todasTareas, loading: l5 } = useCollection<Tarea>('tareas')

  const loading = l1 || l2 || l3 || l4 || l5

  const tareas = todasTareas
    .filter(t => t.estado !== 'completada')
    .sort((a, b) => {
      if (!a.fechaLimite && !b.fechaLimite) return 0
      if (!a.fechaLimite) return 1
      if (!b.fechaLimite) return -1
      return toDate(a.fechaLimite).getTime() - toDate(b.fechaLimite).getTime()
    })

  const leadsActivos  = leads.filter(l => l.estado !== 'descartado').length
  const pipelineTotal = opor.filter(o => !['ganada','perdida'].includes(o.etapa))
    .reduce((acc, o) => acc + (o.valorEstimado ?? 0), 0)
  const proyActivos   = proyectos.filter(p => p.estado === 'activo').length
  const mrr = abonos.filter(a => a.estado === 'activo').reduce((acc, a) => {
    if (a.periodicidad === 'mensual')    return acc + a.monto
    if (a.periodicidad === 'trimestral') return acc + a.monto / 3
    return acc + a.monto / 12
  }, 0)

  const hoy     = new Date()
  const en7dias = addDays(hoy, 7)
  const proximosAbonos = abonos.filter(a => {
    if (a.estado !== 'activo') return false
    const fecha = toDate(a.fechaRenovacion)
    return isAfter(fecha, hoy) && !isAfter(fecha, en7dias)
  })

  const recentLeads  = leads.slice(0, 5)
  const pipelineOpen = opor.filter(o => !['ganada','perdida'].includes(o.etapa)).slice(0, 5)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={`Hola, ${profile?.nombre?.split(' ')[0] ?? 'equipo'} 👋`}
        subtitle={format(new Date(), "EEEE d 'de' MMMM yyyy", { locale: es })}
      />

      <div className="px-4 md:px-8 pb-10 space-y-6 pt-4">

        {loading ? (
          <div className="flex items-center gap-2 text-flux-text3 text-sm">
            <Spinner size={14} /> Cargando métricas…
          </div>
        ) : (
          <>
            {/* KPIs — 2 cols mobile, 4 cols desktop */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
              <StatCard label="Leads activos"     value={leadsActivos}                                    icon={<Users size={16} />} />
              <StatCard label="Pipeline"          value={`$${pipelineTotal.toLocaleString('es-AR')}`}    icon={<TrendingUp size={16} />} />
              <StatCard label="Proyectos activos" value={proyActivos}                                     icon={<FolderKanban size={16} />} />
              <StatCard label="MRR"               value={`$${Math.round(mrr).toLocaleString('es-AR')}`}  icon={<CreditCard size={16} />} />
            </div>

            {/* Alertas */}
            {proximosAbonos.length > 0 && (
              <div className="space-y-2">
                {proximosAbonos.map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-4 py-3 bg-amber-950/40 border border-amber-800/40 rounded-xl text-sm">
                    <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-amber-200 flex-1 text-xs md:text-sm">
                      <strong>{a.nombre}</strong> se renueva el{' '}
                      <strong>{format(toDate(a.fechaRenovacion), "d 'de' MMMM", { locale: es })}</strong>
                      {' '}— ${a.monto.toLocaleString('es-AR')}
                    </span>
                    <Link href="/abonos" className="text-amber-400 shrink-0">
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            )}

            {/* Cards — stack on mobile */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">

              {/* Últimos leads */}
              <div className="flux-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-flux-text1 flex items-center gap-2">
                    <Users size={15} className="text-flux-text3" /> Últimos leads
                  </h2>
                  <Link href="/leads" className="text-xs text-flux-teal hover:underline flex items-center gap-1">
                    Ver todos <ArrowRight size={11} />
                  </Link>
                </div>
                {recentLeads.length === 0 ? (
                  <p className="text-xs text-flux-text3 text-center py-6">Sin leads aún</p>
                ) : (
                  <div className="space-y-2">
                    {recentLeads.map(lead => (
                      <Link key={lead.id} href="/leads"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-flux-muted transition-colors group">
                        <div className="w-7 h-7 rounded-full bg-flux-muted flex items-center justify-center text-xs font-medium text-flux-teal shrink-0">
                          {lead.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-flux-text1 truncate">{lead.nombre}</p>
                          <p className="text-2xs text-flux-text3 truncate">{lead.empresa}</p>
                        </div>
                        <Badge variant={LEAD_ESTADO[lead.estado] ?? 'default'}>{lead.estado}</Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Pipeline */}
              <div className="flux-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-flux-text1 flex items-center gap-2">
                    <TrendingUp size={15} className="text-flux-text3" /> Pipeline activo
                  </h2>
                  <Link href="/oportunidades" className="text-xs text-flux-teal hover:underline flex items-center gap-1">
                    Ver todas <ArrowRight size={11} />
                  </Link>
                </div>
                {pipelineOpen.length === 0 ? (
                  <p className="text-xs text-flux-text3 text-center py-6">Sin oportunidades</p>
                ) : (
                  <div className="space-y-2">
                    {pipelineOpen.map(o => (
                      <Link key={o.id} href="/oportunidades"
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-flux-muted transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-flux-text1 truncate">{o.titulo}</p>
                          <p className="text-2xs text-flux-text3">{ETAPA_LABEL[o.etapa]}</p>
                        </div>
                        <p className="text-sm font-medium text-flux-teal shrink-0">
                          ${o.valorEstimado.toLocaleString('es-AR')}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Tareas */}
              <div className="flux-card xl:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-flux-text1 flex items-center gap-2">
                    <FolderKanban size={15} className="text-flux-text3" /> Tareas pendientes
                  </h2>
                  <Link href="/tareas" className="text-xs text-flux-teal hover:underline flex items-center gap-1">
                    Ver todas <ArrowRight size={11} />
                  </Link>
                </div>
                {tareas.length === 0 ? (
                  <p className="text-xs text-flux-text3 text-center py-6">¡Sin tareas pendientes! 🎉</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {tareas.slice(0, 6).map(t => {
                      const vencida = t.fechaLimite ? isAfter(hoy, toDate(t.fechaLimite)) : false
                      return (
                        <Link key={t.id} href="/tareas"
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-flux-muted transition-colors">
                          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0',
                            t.prioridad === 'urgente' ? 'bg-flux-danger' :
                            t.prioridad === 'alta'    ? 'bg-flux-warning' :
                            t.prioridad === 'media'   ? 'bg-flux-info' : 'bg-flux-text3'
                          )} />
                          <p className="flex-1 text-sm text-flux-text1 truncate">{t.titulo}</p>
                          {t.fechaLimite && (
                            <span className={cn('text-2xs shrink-0', vencida ? 'text-flux-danger' : 'text-flux-text3')}>
                              {format(toDate(t.fechaLimite), "d MMM", { locale: es })}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
