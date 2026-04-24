'use client'

import { useState }        from 'react'
import { useForm }         from 'react-hook-form'
import { zodResolver }     from '@hookform/resolvers/zod'
import { z }               from 'zod'
import { useCollection }   from '@/lib/hooks/useCollection'
import { useAuthContext }  from '@/components/auth/AuthProvider'
import { createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore'
import { PageHeader }      from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import type { Proyecto, ProyectoEstado, Cliente, Propuesta } from '@/types'
import { cn }              from '@/lib/utils'
import { format }          from 'date-fns'
import { es }              from 'date-fns/locale'
import { Timestamp as FSTimestamp } from 'firebase/firestore'
import type { Timestamp }  from 'firebase/firestore'
import Link                from 'next/link'
import { Plus, X, FolderKanban, Pencil, Trash2, MoreHorizontal } from 'lucide-react'

const ESTADOS: ProyectoEstado[] = ['activo', 'pausado', 'completado', 'cancelado']
const ESTADO_BADGE: Record<ProyectoEstado, 'teal' | 'warning' | 'default' | 'danger'> = {
  activo:    'teal',
  pausado:   'warning',
  completado:'default',
  cancelado: 'danger',
}

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

const schema = z.object({
  clienteId:    z.string().min(1, 'Selecciona un cliente'),
  propuestaId:  z.string().optional(),
  nombre:       z.string().min(3, 'Requerido'),
  descripcion:  z.string().min(5, 'Requerido'),
  presupuesto:  z.coerce.number().min(0),
  fechaInicio:  z.string().min(1, 'Requerido'),
  fechaFin:     z.string().optional(),
  estado:       z.enum(['activo', 'pausado', 'completado', 'cancelado']),
})
type FormValues = z.infer<typeof schema>

function ProyectoModal({ proyecto, clientes, propuestas, responsableId, onClose }: {
  proyecto?:     Proyecto
  clientes:      Cliente[]
  propuestas:    Propuesta[]
  responsableId: string
  onClose:       () => void
}) {
  const isEdit = !!proyecto
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: proyecto
      ? {
          ...proyecto,
          fechaInicio: format(toDate(proyecto.fechaInicio), 'yyyy-MM-dd'),
          fechaFin:    proyecto.fechaFin ? format(toDate(proyecto.fechaFin), 'yyyy-MM-dd') : '',
          propuestaId: proyecto.propuestaId ?? '',
        }
      : { estado: 'activo' },
  })

  const selectedClienteId = watch('clienteId')
  const propuestasCliente = propuestas.filter(p => {
    // match via oportunidad — simplified: show all accepted propuestas
    return p.estado === 'aceptada'
  })

  async function onSubmit(values: FormValues) {
    const { fechaInicio, fechaFin, ...rest } = values
    const payload = {
      ...rest,
      responsableId,
      fechaInicio: FSTimestamp.fromDate(new Date(fechaInicio)),
      ...(fechaFin ? { fechaFin: FSTimestamp.fromDate(new Date(fechaFin)) } : {}),
    }
    if (isEdit && proyecto) {
      await updateDocById<Proyecto>('proyectos', proyecto.id, payload)
    } else {
      await createDoc<Proyecto>('proyectos', payload)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-flux-border shrink-0">
          <h2 className="font-display font-bold text-base text-flux-white">
            {isEdit ? 'Editar proyecto' : 'Nuevo proyecto'}
          </h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Nombre *</label>
              <input className={cn('flux-input', errors.nombre && 'border-flux-danger')} placeholder="Ej: Implantación CRM fase 1" {...register('nombre')} />
              {errors.nombre && <p className="mt-1 text-2xs text-flux-danger">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Cliente *</label>
              <select className={cn('flux-input', errors.clienteId && 'border-flux-danger')} {...register('clienteId')}>
                <option value="">Selecciona…</option>
                {clientes.filter(c => c.estado === 'activo').map(c => (
                  <option key={c.id} value={c.id}>{c.empresa}</option>
                ))}
              </select>
              {errors.clienteId && <p className="mt-1 text-2xs text-flux-danger">{errors.clienteId.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Propuesta vinculada</label>
              <select className="flux-input" {...register('propuestaId')}>
                <option value="">Sin propuesta</option>
                {propuestasCliente.map(p => (
                  <option key={p.id} value={p.id}>{p.titulo}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Presupuesto (€)</label>
              <input type="number" min="0" className="flux-input" placeholder="5000" {...register('presupuesto')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado *</label>
              <select className="flux-input" {...register('estado')}>
                {ESTADOS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Fecha inicio *</label>
              <input type="date" className={cn('flux-input', errors.fechaInicio && 'border-flux-danger')} {...register('fechaInicio')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Fecha fin</label>
              <input type="date" className="flux-input" {...register('fechaFin')} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Descripción *</label>
              <textarea rows={3} className={cn('flux-input resize-none', errors.descripcion && 'border-flux-danger')}
                placeholder="Alcance, objetivos y contexto del proyecto…" {...register('descripcion')} />
              {errors.descripcion && <p className="mt-1 text-2xs text-flux-danger">{errors.descripcion.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Guardar' : 'Crear proyecto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProyectosPage() {
  const { profile }    = useAuthContext()
  const { data: proyectos, loading: lp } = useCollection<Proyecto>('proyectos')
  const { data: clientes,  loading: lc } = useCollection<Cliente>('clientes')
  const { data: propuestas,loading: lo } = useCollection<Propuesta>('propuestas')

  const [modal,     setModal]     = useState<'new' | Proyecto | null>(null)
  const [menuId,    setMenuId]    = useState<string | null>(null)
  const [filterEst, setFilterEst] = useState<ProyectoEstado | 'todos'>('todos')

  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]))

  const filtered = proyectos.filter(p =>
    filterEst === 'todos' || p.estado === filterEst
  )

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este proyecto?')) return
    await deleteDocById('proyectos', id)
    setMenuId(null)
  }

  const loading = lp || lc || lo

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Proyectos"
          subtitle={`${proyectos.filter(p => p.estado === 'activo').length} activos · ${proyectos.length} en total`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nuevo proyecto
            </button>
          }
        />

        <div className="px-8 pb-10 space-y-5">
          <div className="flex gap-1.5 flex-wrap">
            {(['todos', ...ESTADOS] as const).map(e => (
              <button key={e} onClick={() => setFilterEst(e)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filterEst === e ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center"><Spinner /> Cargando…</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<FolderKanban size={40} />} title="Sin proyectos"
              description="Crea un proyecto vinculado a un cliente activo."
              action={<button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2"><Plus size={14} /> Crear proyecto</button>} />
          ) : (
            <div className="flux-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Proyecto', 'Cliente', 'Presupuesto', 'Inicio', 'Estado', ''].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-flux-border/50 hover:bg-flux-muted/30 transition-colors group">
                      <td className="px-4 py-3">
                        <Link href={`/proyectos/${p.id}`} className="font-medium text-flux-text1 group-hover:text-flux-white transition-colors hover:underline">
                          {p.nombre}
                        </Link>
                        <p className="text-2xs text-flux-text3 mt-0.5 line-clamp-1">{p.descripcion}</p>
                      </td>
                      <td className="px-4 py-3 text-flux-text2 text-xs">{clienteMap[p.clienteId]?.empresa ?? '—'}</td>
                      <td className="px-4 py-3 font-medium text-flux-teal">€{p.presupuesto.toLocaleString('es-ES')}</td>
                      <td className="px-4 py-3 text-2xs text-flux-text3">{format(toDate(p.fechaInicio), "d MMM yyyy", { locale: es })}</td>
                      <td className="px-4 py-3"><Badge variant={ESTADO_BADGE[p.estado]}>{p.estado}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="relative flex justify-end">
                          <button onClick={() => setMenuId(menuId === p.id ? null : p.id)}
                            className="text-flux-text3 hover:text-flux-text1 opacity-0 group-hover:opacity-100 p-1 rounded">
                            <MoreHorizontal size={15} />
                          </button>
                          {menuId === p.id && (
                            <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[130px]">
                              <button onClick={() => { setModal(p); setMenuId(null) }}
                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                                <Pencil size={11} /> Editar
                              </button>
                              <button onClick={() => handleDelete(p.id)}
                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-danger hover:bg-flux-muted">
                                <Trash2 size={11} /> Eliminar
                              </button>
                            </div>
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

      {modal !== null && (
        <ProyectoModal
          proyecto={modal === 'new' ? undefined : modal}
          clientes={clientes}
          propuestas={propuestas}
          responsableId={profile?.uid ?? ''}
          onClose={() => setModal(null)}
        />
      )}
      {menuId && <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />}
    </>
  )
}
