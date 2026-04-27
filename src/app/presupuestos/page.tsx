'use client'

import { useState }           from 'react'
import Link                   from 'next/link'
import { useCollection }      from '@/lib/hooks/useCollection'
import { deleteDocById }      from '@/lib/firebase/firestore'
import { PageHeader }         from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import type { Presupuesto }   from '@/types/presupuestos'
import { ESTADO_PRESUPUESTO } from '@/types/presupuestos'
import { cn }                 from '@/lib/utils'
import { format }             from 'date-fns'
import { es }                 from 'date-fns/locale'
import {
  Plus, FileText, Eye, Send, Copy,
  Trash2, CheckCircle, XCircle,
} from 'lucide-react'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date(ts)
}

export default function PresupuestosPage() {
  const { data: presupuestos, loading } = useCollection<Presupuesto>('presupuestos')
  const [deleting, setDeleting] = useState<string | null>(null)

  const sorted = [...presupuestos].sort(
    (a, b) => toDate(b.creadoEn).getTime() - toDate(a.creadoEn).getTime()
  )

  const totales = {
    total:    presupuestos.length,
    aceptado: presupuestos.filter(p => p.estado === 'aceptado').length,
    enviado:  presupuestos.filter(p => p.estado === 'enviado').length,
    monto:    presupuestos
      .filter(p => p.estado === 'aceptado')
      .reduce((acc, p) => acc + p.total, 0),
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este presupuesto?')) return
    setDeleting(id)
    await deleteDocById('presupuestos', id)
    setDeleting(null)
  }

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

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total',     value: totales.total,    icon: '📄' },
            { label: 'Enviados',  value: totales.enviado,  icon: '📤' },
            { label: 'Aceptados', value: totales.aceptado, icon: '✅' },
            { label: 'Facturado', value: `$${totales.monto.toLocaleString('es-AR')}`, icon: '💰' },
          ].map(k => (
            <div key={k.label} className="flux-card flex items-center gap-3">
              <span className="text-2xl">{k.icon}</span>
              <div>
                <p className="text-xs text-flux-text3">{k.label}</p>
                <p className="font-bold text-flux-white text-lg">{k.value}</p>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<FileText size={40} />}
            title="Sin presupuestos"
            description="Creá tu primer presupuesto con estimación de horas y costos."
            action={
              <Link href="/presupuestos/nuevo" className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Nuevo presupuesto
              </Link>
            }
          />
        ) : (
          <div className="flux-card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-flux-border">
                  {['Número', 'Cliente / Empresa', 'Total', 'Estado', 'Fecha', ''].map(h => (
                    <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => {
                  const est = ESTADO_PRESUPUESTO[p.estado]
                  return (
                    <tr key={p.id} className="border-b border-flux-border/50 hover:bg-flux-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/presupuestos/${p.id}`}
                          className="font-mono text-sm font-bold text-flux-teal hover:underline">
                          {p.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-flux-text1">{p.clienteNombre}</p>
                        <p className="text-2xs text-flux-text3">{p.empresa}</p>
                      </td>
                      <td className="px-4 py-3 font-bold text-flux-white">
                        {p.moneda === 'USD' ? 'USD ' : '$'}
                        {p.total.toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded-lg text-xs font-medium', est.color)}>
                          {est.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-2xs text-flux-text3">
                        {format(toDate(p.creadoEn), "d MMM yy", { locale: es })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link href={`/presupuestos/${p.id}`}
                            className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-teal hover:bg-flux-tealGlow/20 transition-colors">
                            <Eye size={13} />
                          </Link>
                          <Link href={`/presupuestos/${p.id}/editar`}
                            className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-text1 hover:bg-flux-muted transition-colors">
                            <Copy size={13} />
                          </Link>
                          <button onClick={() => handleDelete(p.id)}
                            disabled={deleting === p.id}
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
        )}
      </div>
    </div>
  )
}
