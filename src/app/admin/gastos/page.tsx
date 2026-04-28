'use client'

import { useState }          from 'react'
import Link                  from 'next/link'
import { useCollection }     from '@/lib/hooks/useCollection'
import { db }                from '@/lib/firebase/config'
import { doc, deleteDoc }    from 'firebase/firestore'
import { PageHeader }        from '@/components/layout/PageHeader'
import { EmptyState, Spinner } from '@/components/ui'
import { DropdownMenu }      from '@/components/ui/DropdownMenu'
import { cn }                from '@/lib/utils'
import {
  Plus, Upload, Search, X,
  TrendingDown, Eye, Pencil, Copy, Trash2,
} from 'lucide-react'

interface Gasto {
  id:              string
  descripcion:     string
  proveedorNombre: string
  categoriaNombre: string
  importe:         number
  moneda:          string
  estado:          string
  periodo:         string
  pagadoPorNombre: string
  creadoEn:        any
}

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date(ts)
}

const ESTADO_STYLE: Record<string, string> = {
  paid:            'text-flux-teal bg-flux-tealGlow',
  pending_payment: 'text-amber-400 bg-amber-950',
  draft:           'text-flux-text3 bg-flux-muted',
  to_reimburse:    'text-blue-400 bg-blue-950',
}
const ESTADO_LABEL: Record<string, string> = {
  paid: 'Pagado', pending_payment: 'Pendiente',
  draft: 'Borrador', to_reimburse: 'A reintegrar',
}

export default function GastosPage() {
  const { data: gastos, loading } = useCollection<Gasto>('adminGastos')
  const [search,   setSearch]   = useState('')
  const [periodo,  setPeriodo]  = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  const periodos = Array.from(new Set(gastos.map(g => g.periodo).filter(Boolean))).sort().reverse()

  const filtered = gastos
    .filter(g => {
      const q = search.toLowerCase()
      const matchSearch = !search ||
        (g.descripcion ?? '').toLowerCase().includes(q) ||
        (g.proveedorNombre ?? '').toLowerCase().includes(q) ||
        (g.categoriaNombre ?? '').toLowerCase().includes(q)
      return matchSearch && (!periodo || g.periodo === periodo)
    })
    .sort((a, b) => toDate(b.creadoEn).getTime() - toDate(a.creadoEn).getTime())

  const totalARS = filtered
    .filter(g => g.estado !== 'draft' && (!g.moneda || g.moneda === 'ARS'))
    .reduce((acc, g) => acc + (g.importe ?? 0), 0)

  async function handleDelete(id: string, desc: string) {
    if (!confirm(`¿Eliminar el gasto "${desc}"?\nEsta acción no se puede deshacer.`)) return
    setDeleting(id)
    try {
      await deleteDoc(doc(db, 'adminGastos', id))
    } catch (err: any) {
      alert('Error al eliminar: ' + (err?.message ?? 'Error desconocido'))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gastos"
        subtitle={`${filtered.length} registros · $${totalARS.toLocaleString('es-AR')} total`}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/gastos/subir" className="btn-ghost flex items-center gap-2 text-sm">
              <Upload size={14} /> Subir factura
            </Link>
            <Link href="/admin/gastos/nuevo" className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Manual
            </Link>
          </div>
        }
      />

      <div className="px-4 md:px-8 pb-10 space-y-4 pt-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input type="month" className="flux-input w-auto text-sm"
            value={periodo} onChange={e => setPeriodo(e.target.value)} />
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3" />
            <input className="flux-input pl-9 text-sm" placeholder="Buscar proveedor, descripción, categoría…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-flux-text3">
                <X size={12} />
              </button>
            )}
          </div>
          {/* Estado tabs */}
          <div className="flex gap-1.5 overflow-x-auto">
            {['Todos','Borrador','Pend. pago','Pagado','Pend. aprobación','Aprobado','Anulado'].map(e => (
              <button key={e}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                  e === 'Todos' ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                {e}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<TrendingDown size={40} />} title="Sin gastos"
            description="Registrá tus gastos y facturas del período."
            action={
              <Link href="/admin/gastos/nuevo" className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Nuevo gasto
              </Link>
            } />
        ) : (
          <div className="flux-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Fecha','Proveedor / Descripción','Categoría','Importe','Pagó / Cargó','Compr.','Estado',''].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(g => (
                    <tr key={g.id} className="border-b border-flux-border/50 hover:bg-flux-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-flux-text3 whitespace-nowrap">
                        {g.periodo?.slice(2).replace('-', '/') ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-flux-text1 text-sm">{g.proveedorNombre || '—'}</p>
                        <p className="text-2xs text-flux-text3">{g.descripcion}</p>
                        <p className="text-2xs text-amber-400">⚠ Sin comprobante</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-flux-text3">{g.categoriaNombre || 'Sin categoría'}</td>
                      <td className="px-4 py-3 font-bold text-flux-teal whitespace-nowrap">
                        ${(g.importe ?? 0).toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold text-white shrink-0"
                              style={{ background: '#00b0ff' }}>
                              {(g.pagadoPorNombre ?? 'M').charAt(0)}
                            </div>
                            <span className="text-xs text-flux-text2">{g.pagadoPorNombre ?? '—'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-2xs font-bold text-white shrink-0"
                              style={{ background: '#00b0ff' }}>
                              M
                            </div>
                            <span className="text-xs text-flux-text3">Martín</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-flux-text3">—</td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded-lg text-xs font-medium',
                          ESTADO_STYLE[g.estado] ?? 'text-flux-text3 bg-flux-muted')}>
                          {ESTADO_LABEL[g.estado] ?? g.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu items={[
                          { label: 'Ver detalle', icon: <Eye size={12} />,    onClick: () => {} },
                          { label: 'Editar',      icon: <Pencil size={12} />, onClick: () => {} },
                          { label: 'Duplicar',    icon: <Copy size={12} />,   onClick: () => {} },
                          { label: 'Eliminar',    icon: <Trash2 size={12} />, onClick: () => handleDelete(g.id, g.descripcion), danger: true },
                        ]} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
