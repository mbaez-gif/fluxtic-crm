'use client'

import { useState }       from 'react'
import Link               from 'next/link'
import { useRouter }      from 'next/navigation'
import { useCollection }  from '@/lib/hooks/useCollection'
import { db }             from '@/lib/firebase/config'
import {
  doc, deleteDoc, addDoc,
  collection, serverTimestamp,
} from 'firebase/firestore'
import { PageHeader }     from '@/components/layout/PageHeader'
import { EmptyState, Spinner } from '@/components/ui'
import type { Presupuesto, PresupuestoEstado } from '@/types/presupuestos'
import { ESTADO_CONFIG, formatMoney }          from '@/types/presupuestos'
import { cn }             from '@/lib/utils'
import { format }         from 'date-fns'
import { es }             from 'date-fns/locale'
import {
  Plus, FileText, Eye, Pencil, Copy,
  Trash2, Send, Download, Search, X,
  Filter,
} from 'lucide-react'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date(ts)
}

export default function PresupuestosPage() {
  const router = useRouter()
  const { data: presupuestos, loading } = useCollection<Presupuesto>('budgets')
  const [search,       setSearch]       = useState('')
  const [filtEstado,   setFiltEstado]   = useState<string>('todos')
  const [deleting,     setDeleting]     = useState<string | null>(null)
  const [duplicating,  setDuplicating]  = useState<string | null>(null)

  const filtered = presupuestos
    .filter(p => {
      const q = search.toLowerCase()
      const matchSearch = !search ||
        p.budgetNumber?.toLowerCase().includes(q) ||
        p.clienteData?.razonSocial?.toLowerCase().includes(q) ||
        p.titulo?.toLowerCase().includes(q)
      const matchEstado = filtEstado === 'todos' || p.estado === filtEstado
      return matchSearch && matchEstado
    })
    .sort((a, b) => toDate(b.creadoEn).getTime() - toDate(a.creadoEn).getTime())

  // KPIs
  const stats = {
    total:     presupuestos.length,
    borradores: presupuestos.filter(p => p.estado === 'borrador').length,
    enviados:   presupuestos.filter(p => p.estado === 'enviado').length,
    aprobados:  presupuestos.filter(p => p.estado === 'aprobado').length,
    rechazados: presupuestos.filter(p => p.estado === 'rechazado').length,
    montoAprobado: presupuestos
      .filter(p => p.estado === 'aprobado')
      .reduce((a, p) => a + (p.total ?? 0), 0),
    montoPendiente: presupuestos
      .filter(p => p.estado === 'enviado')
      .reduce((a, p) => a + (p.total ?? 0), 0),
  }

  async function handleDelete(id: string, num: string) {
    if (!confirm(`¿Eliminar presupuesto ${num}? Esta acción no se puede deshacer.`)) return
    setDeleting(id)
    try { await deleteDoc(doc(db, 'budgets', id)) }
    catch { alert('Error al eliminar') }
    finally { setDeleting(null) }
  }

  async function handleDuplicate(p: Presupuesto) {
    setDuplicating(p.id)
    try {
      // Get new number
      const res   = await fetch('/api/presupuestos/numero', { method: 'POST' })
      const data  = await res.json()
      const { setDoc } = await import('firebase/firestore')

      const { id, creadoEn, actualizadoEn, enviadoEn, aprobadoEn, rechazadoEn, ...rest } = p
      await addDoc(collection(db, 'budgets'), {
        ...rest,
        budgetNumber: data.numero,
        estado:       'borrador',
        titulo:       `${p.titulo} (copia)`,
        creadoEn:     serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      })
    } catch (err) {
      console.error('Error duplicating:', err)
    } finally {
      setDuplicating(null)
    }
  }

  const ESTADOS: { value: string; label: string }[] = [
    { value: 'todos',     label: 'Todos'     },
    { value: 'borrador',  label: 'Borrador'  },
    { value: 'enviado',   label: 'Enviado'   },
    { value: 'aprobado',  label: 'Aprobado'  },
    { value: 'rechazado', label: 'Rechazado' },
    { value: 'vencido',   label: 'Vencido'   },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Presupuestos"
        subtitle={`${presupuestos.length} presupuestos`}
        actions={
          <Link href="/presupuestos/nuevo" className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Nuevo presupuesto
          </Link>
        }
      />

      <div className="px-4 md:px-8 pb-10 space-y-5 pt-4">

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {[
            { label: 'Total',      value: stats.total,          icon: '📄', color: '#94a3b8' },
            { label: 'Borradores', value: stats.borradores,     icon: '✏️', color: '#94a3b8' },
            { label: 'Enviados',   value: stats.enviados,       icon: '📤', color: '#60a5fa' },
            { label: 'Aprobados',  value: stats.aprobados,      icon: '✅', color: '#00D4A8' },
            { label: 'Rechazados', value: stats.rechazados,     icon: '❌', color: '#f87171' },
            { label: 'Monto aprobado', value: `$${Math.round(stats.montoAprobado / 1000)}k`, icon: '💰', color: '#00D4A8' },
            { label: 'Pendiente',  value: `$${Math.round(stats.montoPendiente / 1000)}k`, icon: '⏳', color: '#f59e0b' },
          ].map(k => (
            <div key={k.label} className="flux-card flex flex-col gap-1 py-3">
              <div className="flex items-center gap-2">
                <span className="text-base">{k.icon}</span>
                <p className="text-xs text-flux-text3 truncate">{k.label}</p>
              </div>
              <p className="font-bold text-flux-white text-lg" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3" />
            <input className="flux-input pl-9 text-sm" placeholder="Buscar número, cliente, título…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-flux-text3">
                <X size={12} />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto">
            {ESTADOS.map(e => (
              <button key={e.value} onClick={() => setFiltEstado(e.value)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                  filtEstado === e.value
                    ? 'bg-flux-teal text-flux-bg'
                    : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<FileText size={40} />}
            title="Sin presupuestos"
            description="Todavía no hay presupuestos cargados. Creá tu primera propuesta comercial para un cliente."
            action={
              <Link href="/presupuestos/nuevo" className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Crear presupuesto
              </Link>
            } />
        ) : (
          <div className="flux-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Número', 'Cliente', 'Título', 'Estado', 'Vencimiento', 'Total', 'Resp.', 'Acciones'].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const est = ESTADO_CONFIG[p.estado]
                    const vencido = p.fechaVencimiento && new Date(p.fechaVencimiento) < new Date()
                    return (
                      <tr key={p.id} className="border-b border-flux-border/50 hover:bg-flux-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/presupuestos/${p.id}`}
                            className="font-mono text-sm font-bold text-flux-teal hover:underline">
                            {p.budgetNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-flux-text1 text-sm max-w-[140px] truncate">
                            {p.clienteData?.razonSocial || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <p className="text-sm text-flux-text2 truncate">{p.titulo}</p>
                          <p className="text-2xs text-flux-text3">{p.tipoServicio}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-lg text-xs font-medium"
                            style={{ color: est.color, background: est.bg }}>
                            {est.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.fechaVencimiento ? (
                            <span className={cn('text-xs', vencido ? 'text-flux-danger' : 'text-flux-text3')}>
                              {format(new Date(p.fechaVencimiento), "d MMM yy", { locale: es })}
                            </span>
                          ) : <span className="text-flux-text3 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 font-bold text-flux-white whitespace-nowrap">
                          {formatMoney(p.total ?? 0, p.moneda)}
                        </td>
                        <td className="px-4 py-3 text-xs text-flux-text3 max-w-[80px] truncate">
                          {p.creadoPorNombre?.split(' ')[0] ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5">
                            <Link href={`/presupuestos/${p.id}`}
                              title="Ver"
                              className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-teal hover:bg-flux-tealGlow/20 transition-colors">
                              <Eye size={13} />
                            </Link>
                            <Link href={`/presupuestos/${p.id}/editar`}
                              title="Editar"
                              className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-text1 hover:bg-flux-muted transition-colors">
                              <Pencil size={13} />
                            </Link>
                            <button onClick={() => handleDuplicate(p)}
                              disabled={duplicating === p.id}
                              title="Duplicar"
                              className="p-1.5 rounded-lg text-flux-text3 hover:text-blue-400 hover:bg-blue-950/30 transition-colors">
                              {duplicating === p.id ? <Spinner size={13} /> : <Copy size={13} />}
                            </button>
                            <button onClick={() => handleDelete(p.id, p.budgetNumber)}
                              disabled={deleting === p.id}
                              title="Eliminar"
                              className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-danger hover:bg-red-950/30 transition-colors">
                              {deleting === p.id ? <Spinner size={13} /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
