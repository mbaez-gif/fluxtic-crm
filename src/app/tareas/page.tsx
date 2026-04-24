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
import type { Tarea, TareaEstado, TareaPrioridad, Proyecto } from '@/types'
import { cn }              from '@/lib/utils'
import { format, isAfter } from 'date-fns'
import { es }              from 'date-fns/locale'
import { Timestamp as FSTimestamp } from 'firebase/firestore'
import type { Timestamp }  from 'firebase/firestore'
import { Plus, X, CheckSquare, Trash2, Pencil, MoreHorizontal } from 'lucide-react'

const ESTADOS: TareaEstado[] = ['pendiente', 'en_progreso', 'revision', 'completada']
const ESTADO_LABEL: Record<TareaEstado, string> = {
  pendiente:   'Pendiente',
  en_progreso: 'En progreso',
  revision:    'Revisión',
  completada:  'Completada',
}
const ESTADO_COLOR: Record<TareaEstado, string> = {
  pendiente:   'border-t-flux-text3',
  en_progreso: 'border-t-flux-info',
  revision:    'border-t-flux-warning',
  completada:  'border-t-flux-teal',
}
const PRIORIDAD_DOT: Record<TareaPrioridad, string> = {
  baja:    'bg-flux-text3',
  media:   'bg-flux-info',
  alta:    'bg-flux-warning',
  urgente: 'bg-flux-danger',
}

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

const schema = z.object({
  titulo:      z.string().min(2, 'Requerido'),
  descripcion: z.string().optional(),
  proyectoId:  z.string().optional(),
  prioridad:   z.enum(['baja', 'media', 'alta', 'urgente']),
  estado:      z.enum(['pendiente', 'en_progreso', 'revision', 'completada']),
  fechaLimite: z.string().optional(),
  etiquetas:   z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// ── Modal ─────────────────────────────────────────────────
function TareaModal({ tarea, proyectos, responsableId, defaultEstado, onClose }: {
  tarea?:        Tarea
  proyectos:     Proyecto[]
  responsableId: string
  defaultEstado?: TareaEstado
  onClose:       () => void
}) {
  const isEdit = !!tarea
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: tarea
      ? {
          titulo:      tarea.titulo,
          descripcion: tarea.descripcion ?? '',
          proyectoId:  tarea.proyectoId ?? '',
          prioridad:   tarea.prioridad,
          estado:      tarea.estado,
          fechaLimite: tarea.fechaLimite ? format(toDate(tarea.fechaLimite), 'yyyy-MM-dd') : '',
          etiquetas:   tarea.etiquetas?.join(', ') ?? '',
        }
      : { prioridad: 'media', estado: defaultEstado ?? 'pendiente' },
  })

  async function onSubmit(values: FormValues) {
    const { fechaLimite, etiquetas, ...rest } = values
    const payload = {
      ...rest,
      responsableId,
      etiquetas: etiquetas ? etiquetas.split(',').map(e => e.trim()).filter(Boolean) : [],
      ...(fechaLimite ? { fechaLimite: FSTimestamp.fromDate(new Date(fechaLimite)) } : {}),
    }
    if (isEdit && tarea) {
      await updateDocById<Tarea>('tareas', tarea.id, payload)
    } else {
      await createDoc<Tarea>('tareas', payload)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in">
        <div className="flex items-center justify-between px-6 py-5 border-b border-flux-border">
          <h2 className="font-display font-bold text-base text-flux-white">
            {isEdit ? 'Editar tarea' : 'Nueva tarea'}
          </h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Título *</label>
            <input className={cn('flux-input', errors.titulo && 'border-flux-danger')}
              placeholder="¿Qué hay que hacer?" {...register('titulo')} />
            {errors.titulo && <p className="mt-1 text-2xs text-flux-danger">{errors.titulo.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado</label>
              <select className="flux-input" {...register('estado')}>
                {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Prioridad</label>
              <select className="flux-input" {...register('prioridad')}>
                {(['baja', 'media', 'alta', 'urgente'] as TareaPrioridad[]).map(p => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Proyecto</label>
              <select className="flux-input" {...register('proyectoId')}>
                <option value="">Sin proyecto</option>
                {proyectos.filter(p => p.estado === 'activo').map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Fecha límite</label>
              <input type="date" className="flux-input" {...register('fechaLimite')} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Descripción</label>
            <textarea rows={3} className="flux-input resize-none" placeholder="Detalles, contexto, links…" {...register('descripcion')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">
              Etiquetas <span className="text-flux-text3 font-normal">(separadas por coma)</span>
            </label>
            <input className="flux-input" placeholder="diseño, cliente, urgente…" {...register('etiquetas')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Guardar' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Kanban card ───────────────────────────────────────────
function TareaCard({ tarea, proyectoNombre, onEdit, onDelete, onMove }: {
  tarea:          Tarea
  proyectoNombre: string
  onEdit:         () => void
  onDelete:       () => void
  onMove:         (estado: TareaEstado) => void
}) {
  const [menu, setMenu] = useState(false)
  const hoy     = new Date()
  const vencida = tarea.fechaLimite && tarea.estado !== 'completada'
    ? isAfter(hoy, toDate(tarea.fechaLimite)) : false

  return (
    <div className="bg-flux-surface border border-flux-border rounded-xl p-3.5 group hover:border-flux-muted transition-all">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm text-flux-text1 group-hover:text-flux-white transition-colors leading-snug flex-1">
          {tarea.titulo}
        </p>
        <div className="relative shrink-0">
          <button onClick={() => setMenu(m => !m)}
            className="text-flux-text3 hover:text-flux-text1 p-0.5 opacity-0 group-hover:opacity-100 transition-all">
            <MoreHorizontal size={13} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[150px]">
                <p className="px-3 py-1 text-2xs text-flux-text3 border-b border-flux-border mb-1">Mover a</p>
                {ESTADOS.filter(e => e !== tarea.estado).map(e => (
                  <button key={e} onClick={() => { onMove(e); setMenu(false) }}
                    className="w-full text-left px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted transition-colors">
                    {ESTADO_LABEL[e]}
                  </button>
                ))}
                <div className="border-t border-flux-border mt-1 pt-1">
                  <button onClick={() => { onEdit(); setMenu(false) }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                    <Pencil size={11} /> Editar
                  </button>
                  <button onClick={() => { onDelete(); setMenu(false) }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-danger hover:bg-flux-muted">
                    <Trash2 size={11} /> Eliminar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {tarea.descripcion && (
        <p className="text-2xs text-flux-text3 mb-2 line-clamp-2">{tarea.descripcion}</p>
      )}

      {proyectoNombre && (
        <p className="text-2xs text-flux-text3 mb-2 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-flux-teal inline-block" />
          {proyectoNombre}
        </p>
      )}

      {tarea.etiquetas && tarea.etiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {tarea.etiquetas.slice(0, 3).map(e => (
            <span key={e} className="text-2xs bg-flux-muted text-flux-text3 px-1.5 py-0.5 rounded-full">{e}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className={cn('w-1.5 h-1.5 rounded-full', PRIORIDAD_DOT[tarea.prioridad])} title={tarea.prioridad} />
        {tarea.fechaLimite && (
          <span className={cn('text-2xs', vencida ? 'text-flux-danger font-medium' : 'text-flux-text3')}>
            {vencida ? '⚠ ' : ''}{format(toDate(tarea.fechaLimite), "d MMM", { locale: es })}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Kanban column ─────────────────────────────────────────
function KanbanCol({ estado, tareas, proyectoMap, onAdd, onEdit, onDelete }: {
  estado:      TareaEstado
  tareas:      Tarea[]
  proyectoMap: Record<string, Proyecto>
  onAdd:       () => void
  onEdit:      (t: Tarea) => void
  onDelete:    (id: string) => void
}) {
  async function handleMove(tarea: Tarea, newEstado: TareaEstado) {
    await updateDocById<Tarea>('tareas', tarea.id, { estado: newEstado })
  }

  return (
    <div className="flex flex-col min-w-[240px] max-w-[240px]">
      <div className={cn('bg-flux-card border border-flux-border rounded-t-xl px-4 py-3 border-t-2', ESTADO_COLOR[estado])}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-flux-text1">{ESTADO_LABEL[estado]}</span>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-flux-text3 bg-flux-muted px-1.5 py-0.5 rounded-full">{tareas.length}</span>
            <button onClick={onAdd} className="text-flux-text3 hover:text-flux-teal transition-colors">
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-flux-surface/30 border-x border-b border-flux-border rounded-b-xl p-2 space-y-2 min-h-[300px]">
        {tareas.map(t => (
          <TareaCard
            key={t.id}
            tarea={t}
            proyectoNombre={t.proyectoId ? (proyectoMap[t.proyectoId]?.nombre ?? '') : ''}
            onEdit={() => onEdit(t)}
            onDelete={() => onDelete(t.id)}
            onMove={newEstado => handleMove(t, newEstado)}
          />
        ))}
        {tareas.length === 0 && (
          <button onClick={onAdd}
            className="w-full border border-dashed border-flux-border rounded-xl p-4 text-xs text-flux-text3 hover:border-flux-muted hover:text-flux-text2 transition-colors">
            + Añadir tarea
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function TareasPage() {
  const { profile }  = useAuthContext()
  const { data: tareas,    loading: lt } = useCollection<Tarea>('tareas')
  const { data: proyectos, loading: lp } = useCollection<Proyecto>('proyectos')

  const [modal,         setModal]         = useState<'new' | { tarea?: Tarea; estado?: TareaEstado } | null>(null)
  const [filterProyecto,setFilterProyecto] = useState<string>('todos')

  const proyectoMap = Object.fromEntries(proyectos.map(p => [p.id, p]))

  const tareasFiltradas = tareas.filter(t =>
    filterProyecto === 'todos' || t.proyectoId === filterProyecto
  )

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta tarea?')) return
    await deleteDocById('tareas', id)
  }

  const loading = lt || lp

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Tareas"
          subtitle={`${tareas.filter(t => t.estado !== 'completada').length} pendientes · ${tareas.filter(t => t.estado === 'completada').length} completadas`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nueva tarea
            </button>
          }
        />

        <div className="px-8 pb-10 space-y-5">
          {/* Filtro por proyecto */}
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterProyecto('todos')}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filterProyecto === 'todos' ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
              Todas
            </button>
            <button onClick={() => setFilterProyecto('')}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                filterProyecto === '' ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
              Sin proyecto
            </button>
            {proyectos.filter(p => p.estado === 'activo').map(p => (
              <button key={p.id} onClick={() => setFilterProyecto(p.id)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filterProyecto === p.id ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                {p.nombre}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center"><Spinner /> Cargando…</div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {ESTADOS.map(estado => (
                <KanbanCol
                  key={estado}
                  estado={estado}
                  tareas={tareasFiltradas.filter(t => t.estado === estado)}
                  proyectoMap={proyectoMap}
                  onAdd={() => setModal({ estado })}
                  onEdit={t => setModal({ tarea: t })}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {modal !== null && (
        <TareaModal
          tarea={modal === 'new' ? undefined : (modal as { tarea?: Tarea }).tarea}
          proyectos={proyectos}
          responsableId={profile?.uid ?? ''}
          defaultEstado={modal === 'new' ? 'pendiente' : (modal as { estado?: TareaEstado }).estado}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
