'use client'

import { useState }        from 'react'
import { useDocument }     from '@/lib/hooks/useDocument'
import { useCollection }   from '@/lib/hooks/useCollection'
import { useAuthContext }  from '@/components/auth/AuthProvider'
import { createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore'
import { Badge, Spinner, EmptyState } from '@/components/ui'
import { PageHeader }      from '@/components/layout/PageHeader'
import type { Proyecto, Tarea, TareaEstado, TareaPrioridad, Cliente } from '@/types'
import { cn }              from '@/lib/utils'
import { format }          from 'date-fns'
import { es }              from 'date-fns/locale'
import { Timestamp as FSTimestamp } from 'firebase/firestore'
import type { Timestamp }  from 'firebase/firestore'
import Link                from 'next/link'
import { useForm }         from 'react-hook-form'
import { zodResolver }     from '@hookform/resolvers/zod'
import { z }               from 'zod'
import { ArrowLeft, Plus, X, CheckSquare, Trash2, Circle } from 'lucide-react'

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

const TAREA_ESTADOS: TareaEstado[] = ['pendiente', 'en_progreso', 'revision', 'completada']
const ESTADO_LABEL: Record<TareaEstado, string> = {
  pendiente:   'Pendiente',
  en_progreso: 'En progreso',
  revision:    'Revisión',
  completada:  'Completada',
}
const PRIORIDAD_COLOR: Record<TareaPrioridad, string> = {
  baja:    'bg-flux-text3',
  media:   'bg-flux-info',
  alta:    'bg-flux-warning',
  urgente: 'bg-flux-danger',
}

const tareaSchema = z.object({
  titulo:      z.string().min(2, 'Requerido'),
  descripcion: z.string().optional(),
  prioridad:   z.enum(['baja', 'media', 'alta', 'urgente']),
  fechaLimite: z.string().optional(),
})
type TareaForm = z.infer<typeof tareaSchema>

export default function ProyectoDetailPage({ params }: { params: { id: string } }) {
  const { id }      = params
  const { profile } = useAuthContext()
  const { data: proyecto, loading: lp } = useDocument<Proyecto>('proyectos', id)
  const { data: tareas,   loading: lt } = useCollection<Tarea>('tareas', {
    filters: [{ field: 'proyectoId', op: '==', value: id }],
    orderField: 'creadoEn', orderDir: 'asc',
  })
  const { data: clientes } = useCollection<Cliente>('clientes')

  const [showForm, setShowForm] = useState(false)
  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]))

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TareaForm>({
    resolver: zodResolver(tareaSchema),
    defaultValues: { prioridad: 'media' },
  })

  async function onAddTarea(values: TareaForm) {
    const { fechaLimite, ...rest } = values
    await createDoc<Tarea>('tareas', {
      ...rest,
      proyectoId:    id,
      responsableId: profile?.uid ?? '',
      estado:        'pendiente',
      etiquetas:     [],
      ...(fechaLimite ? { fechaLimite: FSTimestamp.fromDate(new Date(fechaLimite)) } : {}),
    })
    reset()
    setShowForm(false)
  }

  async function handleEstado(tarea: Tarea, estado: TareaEstado) {
    await updateDocById<Tarea>('tareas', tarea.id, { estado })
  }

  async function handleDelete(tareaId: string) {
    await deleteDocById('tareas', tareaId)
  }

  const completadas  = tareas.filter(t => t.estado === 'completada').length
  const progreso     = tareas.length > 0 ? Math.round((completadas / tareas.length) * 100) : 0

  if (lp) return <div className="flex items-center justify-center min-h-screen"><Spinner size={24} /></div>
  if (!proyecto) return <div className="px-8 py-20"><EmptyState title="Proyecto no encontrado" /></div>

  const cliente = clienteMap[proyecto.clienteId]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={proyecto.nombre}
        subtitle={`${cliente?.empresa ?? '—'}${proyecto.presupuesto ? ` · $${proyecto.presupuesto.toLocaleString('es-AR')}` : ''}`}
        actions={
          <Link href="/proyectos" className="btn-ghost flex items-center gap-2 text-sm">
            <ArrowLeft size={14} /> Volver
          </Link>
        }
      />

      <div className="px-8 pb-10 space-y-6">

        {/* Info bar */}
        <div className="flux-card">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">Estado</p>
              <Badge variant={proyecto.estado === 'activo' ? 'teal' : proyecto.estado === 'completado' ? 'default' : 'warning'}>
                {proyecto.estado}
              </Badge>
            </div>
            <div>
              <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">Inicio</p>
              <p className="text-sm text-flux-text1">{format(toDate(proyecto.fechaInicio), "d MMM yyyy", { locale: es })}</p>
            </div>
            <div>
              <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">Fin estimado</p>
              <p className="text-sm text-flux-text1">
                {proyecto.fechaFin ? format(toDate(proyecto.fechaFin), "d MMM yyyy", { locale: es }) : 'Sin fecha'}
              </p>
            </div>
            <div>
              <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">Progreso tareas</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-flux-muted rounded-full overflow-hidden">
                  <div className="h-full bg-flux-teal rounded-full transition-all" style={{ width: `${progreso}%` }} />
                </div>
                <span className="text-xs text-flux-teal font-medium">{progreso}%</span>
              </div>
            </div>
          </div>
          {proyecto.descripcion && (
            <p className="mt-4 text-sm text-flux-text2 border-t border-flux-border pt-4">{proyecto.descripcion}</p>
          )}
        </div>

        {/* Tareas */}
        <div className="flux-card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-medium text-flux-text1 flex items-center gap-2">
              <CheckSquare size={15} className="text-flux-text3" />
              Tareas
              <span className="text-2xs text-flux-text3 bg-flux-muted px-1.5 py-0.5 rounded-full">
                {completadas}/{tareas.length}
              </span>
            </h2>
            <button onClick={() => setShowForm(s => !s)} className="btn-primary flex items-center gap-1.5 text-xs py-1.5">
              <Plus size={12} /> Nueva tarea
            </button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="mb-4 p-4 bg-flux-surface border border-flux-border rounded-xl space-y-3">
              <form onSubmit={handleSubmit(onAddTarea)}>
                <input className={cn('flux-input mb-3', errors.titulo && 'border-flux-danger')}
                  placeholder="Nombre de la tarea…" {...register('titulo')} autoFocus />
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <select className="flux-input text-xs" {...register('prioridad')}>
                    {(['baja', 'media', 'alta', 'urgente'] as TareaPrioridad[]).map(p => (
                      <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                    ))}
                  </select>
                  <input type="date" className="flux-input text-xs" {...register('fechaLimite')} />
                </div>
                <textarea rows={2} className="flux-input resize-none text-xs mb-3"
                  placeholder="Descripción opcional…" {...register('descripcion')} />
                <div className="flex gap-2">
                  <button type="submit" disabled={isSubmitting} className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
                    {isSubmitting && <div className="w-3 h-3 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
                    Añadir
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-xs py-1.5">Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {lt ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : tareas.length === 0 ? (
            <EmptyState icon={<CheckSquare size={32} />} title="Sin tareas"
              description="Añade tareas para gestionar el trabajo del proyecto." />
          ) : (
            <div className="space-y-1">
              {TAREA_ESTADOS.map(estado => {
                const tareasEstado = tareas.filter(t => t.estado === estado)
                if (tareasEstado.length === 0) return null
                return (
                  <div key={estado}>
                    <p className="text-2xs text-flux-text3 uppercase tracking-widest px-2 py-2 mt-3 first:mt-0">
                      {ESTADO_LABEL[estado]} ({tareasEstado.length})
                    </p>
                    {tareasEstado.map(tarea => (
                      <div key={tarea.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-flux-muted/30 transition-colors group">
                        {/* Status toggle */}
                        <button
                          onClick={() => {
                            const next: TareaEstado = tarea.estado === 'completada' ? 'pendiente'
                              : tarea.estado === 'pendiente' ? 'en_progreso'
                              : tarea.estado === 'en_progreso' ? 'revision'
                              : 'completada'
                            handleEstado(tarea, next)
                          }}
                          className="shrink-0 text-flux-text3 hover:text-flux-teal transition-colors"
                          title="Cambiar estado"
                        >
                          {tarea.estado === 'completada'
                            ? <CheckSquare size={16} className="text-flux-teal" />
                            : <Circle size={16} />}
                        </button>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-sm', tarea.estado === 'completada' ? 'line-through text-flux-text3' : 'text-flux-text1')}>
                            {tarea.titulo}
                          </p>
                          {tarea.descripcion && (
                            <p className="text-2xs text-flux-text3 truncate">{tarea.descripcion}</p>
                          )}
                        </div>

                        {/* Priority dot */}
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORIDAD_COLOR[tarea.prioridad])} title={tarea.prioridad} />

                        {/* Date */}
                        {tarea.fechaLimite && (
                          <span className="text-2xs text-flux-text3 shrink-0">
                            {format(toDate(tarea.fechaLimite), "d MMM", { locale: es })}
                          </span>
                        )}

                        {/* Delete */}
                        <button onClick={() => handleDelete(tarea.id)}
                          className="text-flux-text3 hover:text-flux-danger transition-colors opacity-0 group-hover:opacity-100 p-1 rounded shrink-0">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
