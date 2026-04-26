'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthContext }  from '@/components/auth/AuthProvider'
import { PageHeader }      from '@/components/layout/PageHeader'
import { Badge, Spinner }  from '@/components/ui'
import { db }              from '@/lib/firebase/config'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { getPeriodoActual, formatMonto } from '@/lib/firebase/admin'
import type { Gasto, GastoEstado } from '@/types/admin'
import { GASTO_ESTADO_LABEL, MONEDA_SYMBOL, SOCIOS } from '@/types/admin'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import {
  Plus, Upload, Search, X, Filter,
  Pencil, Trash2, Copy, Paperclip, Eye,
  MoreHorizontal, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { updateGasto, cancelGasto } from '@/lib/firebase/admin'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date()
}

const ESTADO_BADGE: Record<GastoEstado, 'default' | 'teal' | 'warning' | 'danger' | 'info'> = {
  draft:            'default',
  pending_payment:  'warning',
  paid:             'teal',
  pending_approval: 'warning',
  approved:         'teal',
  rejected:         'danger',
  to_reimburse:     'info',
  reimbursed:       'teal',
  cancelled:        'danger',
}

export default function GastosPage() {
  const { user } = useAuthContext()
  const [periodo,  setPeriodo]  = useState(getPeriodoActual())
  const [gastos,   setGastos]   = useState<Gasto[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [filtEst,  setFiltEst]  = useState<GastoEstado | 'todos'>('todos')
  const [menuId,   setMenuId]   = useState<string | null>(null)

  const loadGastos = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const q    = query(collection(db, 'adminGastos'), where('periodo', '==', periodo))
      const snap = await getDocs(q)
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Gasto)
        .sort((a, b) => toDate(b.fecha).getTime() - toDate(a.fecha).getTime())
      setGastos(data)
    } finally {
      setLoading(false)
    }
  }, [user, periodo])

  useEffect(() => { loadGastos() }, [loadGastos])

  const filtered = gastos.filter(g => {
    const matchSearch = !search || [g.proveedorNombre, g.descripcion, g.categoriaNombre]
      .some(f => f?.toLowerCase().includes(search.toLowerCase()))
    const matchEst = filtEst === 'todos' || g.estado === filtEst
    return matchSearch && matchEst
  })

  async function handleCancel(id: string) {
    if (!user || !confirm('¿Anular este gasto?')) return
    await cancelGasto(id, user.uid)
    setMenuId(null)
    loadGastos()
  }

  const totalFiltrado = filtered
    .filter(g => g.estado !== 'cancelled')
    .reduce((acc, g) => acc + (g.importeARS ?? g.importe), 0)

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Gastos"
          subtitle={`${filtered.length} registros · ${formatMonto(totalFiltrado, 'ARS')} total`}
          actions={
            <div className="flex items-center gap-2">
              <Link href="/admin/gastos/nuevo" className="btn-ghost flex items-center gap-2 text-sm">
                <Plus size={14} /> Manual
              </Link>
              <Link href="/admin/gastos/subir" className="btn-primary flex items-center gap-2 text-sm">
                <Upload size={14} /> Subir factura
              </Link>
            </div>
          }
        />

        <div className="px-8 pb-10 space-y-5">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="month"
              value={periodo}
              onChange={e => setPeriodo(e.target.value)}
              className="flux-input w-auto text-sm"
            />
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3" />
              <input className="flux-input pl-9 text-sm" placeholder="Buscar proveedor, descripción, categoría…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-flux-text3 hover:text-flux-text1">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['todos', 'draft', 'pending_payment', 'paid', 'pending_approval', 'approved', 'cancelled'] as const).map(e => (
                <button key={e} onClick={() => setFiltEst(e)}
                  className={cn('px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                    filtEst === e ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                  {e === 'todos' ? 'Todos' : GASTO_ESTADO_LABEL[e]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Spinner size={24} /></div>
          ) : filtered.length === 0 ? (
            <div className="flux-card text-center py-16">
              <p className="text-flux-text3 text-sm mb-4">Sin gastos en este período</p>
              <Link href="/admin/gastos/nuevo" className="btn-primary inline-flex items-center gap-2 text-sm">
                <Plus size={14} /> Cargar primer gasto
              </Link>
            </div>
          ) : (
            <div className="flux-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Fecha', 'Proveedor / Descripción', 'Categoría', 'Importe', 'Pagó / Cargó', 'Compr.', 'Estado', ''].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(g => (
                    <tr key={g.id}
                      className={cn('border-b border-flux-border/50 hover:bg-flux-muted/20 transition-colors',
                        g.estado === 'cancelled' && 'opacity-50')}>
                      <td className="px-4 py-3 text-xs text-flux-text3 whitespace-nowrap">
                        {format(toDate(g.fecha), 'dd/MM/yy')}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-flux-text1 text-sm truncate max-w-[180px]">{g.proveedorNombre}</p>
                        <p className="text-2xs text-flux-text3 truncate max-w-[180px]">{g.descripcion}</p>
                        {g.tieneComprobante === false && g.estado !== 'cancelled' && (
                          <span className="text-2xs text-amber-400 flex items-center gap-0.5 mt-0.5">
                            <AlertTriangle size={9} /> Sin comprobante
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-flux-text2">{g.categoriaNombre}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-flux-teal text-sm">
                          {MONEDA_SYMBOL[g.moneda]}{g.importe.toLocaleString('es-AR')}
                        </p>
                        {g.tipoCambio && (
                          <p className="text-2xs text-flux-text3">TC: ${g.tipoCambio}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="w-5 h-5 rounded-full bg-flux-teal/20 flex items-center justify-center text-2xs font-bold text-flux-teal">
                            {g.pagadoPorNombre.charAt(0)}
                          </div>
                          <span className="text-xs text-flux-text2">{g.pagadoPorNombre}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="w-5 h-5 rounded-full bg-flux-muted flex items-center justify-center text-2xs font-bold text-flux-text3">
                            {g.cargadoPorNombre.charAt(0)}
                          </div>
                          <span className="text-2xs text-flux-text3">{g.cargadoPorNombre}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {g.tieneComprobante
                          ? <CheckCircle size={14} className="text-flux-teal" />
                          : <span className="text-2xs text-flux-text3">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ESTADO_BADGE[g.estado]}>
                          {GASTO_ESTADO_LABEL[g.estado]}
                        </Badge>
                        {g.incluidoEnCierre && (
                          <p className="text-2xs text-flux-teal mt-0.5">En cierre</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button onClick={() => setMenuId(menuId === g.id ? null : g.id)}
                            className="text-flux-text2 hover:text-flux-white p-1 rounded transition-colors">
                            <MoreHorizontal size={14} />
                          </button>
                          {menuId === g.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                              <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[150px]">
                                <Link href={`/admin/gastos/${g.id}`}
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                                  <Eye size={11} /> Ver detalle
                                </Link>
                                <Link href={`/admin/gastos/${g.id}/editar`}
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                                  <Pencil size={11} /> Editar
                                </Link>
                                <Link href={`/admin/gastos/${g.id}/duplicar`}
                                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                                  <Copy size={11} /> Duplicar
                                </Link>
                                {!g.tieneComprobante && (
                                  <Link href={`/admin/gastos/${g.id}/comprobante`}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                                    <Paperclip size={11} /> Adjuntar comprobante
                                  </Link>
                                )}
                                {g.estado !== 'cancelled' && (
                                  <button onClick={() => handleCancel(g.id)}
                                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-danger hover:bg-flux-muted">
                                    <Trash2 size={11} /> Anular
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
