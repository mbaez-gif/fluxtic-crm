'use client'

import { useState }          from 'react'
import Link                  from 'next/link'
import { useCollection }     from '@/lib/hooks/useCollection'
import { db }                from '@/lib/firebase/config'
import { doc, deleteDoc }    from 'firebase/firestore'
import { PageHeader }        from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { cn }                from '@/lib/utils'
import { format }            from 'date-fns'
import { es }                from 'date-fns/locale'
import {
  Plus, Upload, Trash2, Search, X,
  TrendingDown, Filter,
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
  paid: 'Pagado', pending_payment: 'Pendiente', draft: 'Borrador', to_reimburse: 'A reintegrar',
}

export default function GastosPage() {
  const { data: gastos, loading } = useCollection<Gasto>('adminGastos')
  const [search,   setSearch]   = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [periodo,  setPeriodo]  = useState('')

  const periodos = [...new Set(gastos.map(g => g.periodo))].sort().reverse()

  const filtered = gastos
    .filter(g => {
      const q = search.toLowerCase()
      const matchSearch = !search ||
        g.descripcion?.toLowerCase().includes(q) ||
        g.proveedorNombre?.toLowerCase().includes(q) ||
        g.categoriaNombre?.toLowerCase().includes(q)
      const matchPeriodo = !periodo || g.periodo === periodo
      return matchSearch && matchPeriodo
    })
    .sort((a, b) => toDate(b.creadoEn).getTime() - toDate(a.creadoEn).getTime())

  const totalARS = filtered
    .filter(g => g.estado !== 'draft' && g.moneda === 'ARS')
    .reduce((acc, g) => acc + (g.importe ?? 0), 0)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return
    setDeleting(id)
    try {
      await deleteDoc(doc(db, 'adminGastos', id))
    } catch (err) {
      console.error('Error deleting gasto:', err)
      alert('Error al eliminar')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gastos"
        subtitle={`${filtered.length} gastos · $${totalARS.toLocaleString('es-AR')} ARS`}
        actions={
          <div className="flex gap-2">
            <Link href="/admin/gastos/subir" className="btn-ghost flex items-center gap-2 text-sm">
              <Upload size={14} /> Subir factura
            </Link>
            <Link href="/admin/gastos/nuevo" className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Nuevo gasto
            </Link>
          </div>
        }
      />

      <div className="px-4 md:px-8 pb-10 space-y-4 pt-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3" />
            <input className="flux-input pl-9 text-sm" placeholder="Buscar descripción, proveedor…"
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-flux-text3">
                <X size={12} />
              </button>
            )}
          </div>
          <select className="flux-input w-auto text-sm" value={periodo} onChange={e => setPeriodo(e.target.value)}>
            <option value="">Todos los períodos</option>
            {periodos.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-flux-border">
                  {['Descripción', 'Proveedor', 'Categoría', 'Importe', 'Pagó', 'Estado', ''].map(h => (
                    <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id} className="border-b border-flux-border/50 hover:bg-flux-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-flux-text1 text-sm">{g.descripcion}</p>
                      <p className="text-2xs text-flux-text3">{g.periodo}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-flux-text2">{g.proveedorNombre}</td>
                    <td className="px-4 py-3 text-xs text-flux-text3">{g.categoriaNombre || '—'}</td>
                    <td className="px-4 py-3 font-medium text-flux-white whitespace-nowrap">
                      {g.moneda !== 'ARS' ? `${g.moneda} ` : '$'}
                      {g.importe?.toLocaleString('es-AR') ?? '0'}
                    </td>
                    <td className="px-4 py-3 text-xs text-flux-text3">{g.pagadoPorNombre}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-1 rounded-lg text-xs font-medium',
                        ESTADO_STYLE[g.estado] ?? 'text-flux-text3 bg-flux-muted')}>
                        {ESTADO_LABEL[g.estado] ?? g.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(g.id)}
                        disabled={deleting === g.id}
                        title="Eliminar gasto"
                        className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-danger hover:bg-red-950/30 transition-colors">
                        {deleting === g.id ? <Spinner size={13} /> : <Trash2 size={13} />}
                      </button>
                    </td>
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
