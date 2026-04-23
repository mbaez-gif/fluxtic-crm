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
import type { Diagnostico, DiagnosticoEstado, Lead } from '@/types'
import { cn }              from '@/lib/utils'
import { format }          from 'date-fns'
import { es }              from 'date-fns/locale'
import type { Timestamp }  from 'firebase/firestore'
import {
  Plus, X, Stethoscope, Pencil, Trash2,
  MoreHorizontal, ChevronDown, ExternalLink,
} from 'lucide-react'

// ── Schema ────────────────────────────────────────────────
const schema = z.object({
  leadId:          z.string().min(1, 'Selecciona un lead'),
  titulo:          z.string().min(3, 'Requerido'),
  hallazgos:       z.string().min(10, 'Describe los hallazgos'),
  recomendaciones: z.string().min(10, 'Describe las recomendaciones'),
  estado:          z.enum(['borrador', 'en_revision', 'completado']),
})
type FormValues = z.infer<typeof schema>

const ESTADOS: DiagnosticoEstado[] = ['borrador', 'en_revision', 'completado']
const ESTADO_BADGE: Record<DiagnosticoEstado, 'default' | 'warning' | 'teal'> = {
  borrador:    'default',
  en_revision: 'warning',
  completado:  'teal',
}
const ESTADO_LABEL: Record<DiagnosticoEstado, string> = {
  borrador:    'Borrador',
  en_revision: 'En revisión',
  completado:  'Completado',
}

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

// ── Modal ─────────────────────────────────────────────────
function DiagModal({
  diag,
  leads,
  responsableId,
  onClose,
}: {
  diag?:         Diagnostico
  leads:         Lead[]
  responsableId: string
  onClose:       () => void
}) {
  const isEdit = !!diag
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: diag
      ? {
          leadId:          diag.leadId,
          titulo:          diag.titulo,
          hallazgos:       diag.hallazgos,
          recomendaciones: diag.recomendaciones,
          estado:          diag.estado,
        }
      : { estado: 'borrador' },
  })

  async function onSubmit(values: FormValues) {
    if (isEdit && diag) {
      await updateDocById<Diagnostico>('diagnosticos', diag.id, values)
    } else {
      await createDoc<Diagnostico>('diagnosticos', { ...values, responsableId })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-flux-border shrink-0">
          <h2 className="font-display font-bold text-base text-flux-white">
            {isEdit ? 'Editar diagnóstico' : 'Nuevo diagnóstico'}
          </h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Lead selector */}
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Lead asociado *</label>
            <select className={cn('flux-input', errors.leadId && 'border-flux-danger')} {...register('leadId')}>
              <option value="">Selecciona un lead calificado…</option>
              {leads
                .filter(l => l.estado === 'calificado')
                .map(l => (
                  <option key={l.id} value={l.id}>
                    {l.nombre} — {l.empresa}
                  </option>
                ))}
            </select>
            {errors.leadId && <p className="mt-1 text-2xs text-flux-danger">{errors.leadId.message}</p>}
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Título del diagnóstico *</label>
            <input
              className={cn('flux-input', errors.titulo && 'border-flux-danger')}
              placeholder="Ej: Diagnóstico de procesos comerciales Q3"
              {...register('titulo')}
            />
            {errors.titulo && <p className="mt-1 text-2xs text-flux-danger">{errors.titulo.message}</p>}
          </div>

          {/* Estado */}
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado *</label>
            <select className="flux-input" {...register('estado')}>
              {ESTADOS.map(e => (
                <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
              ))}
            </select>
          </div>

          {/* Hallazgos */}
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">
              Hallazgos *
              <span className="ml-2 text-flux-text3 font-normal normal-case">Describe los problemas o áreas de mejora identificadas</span>
            </label>
            <textarea
              rows={5}
              className={cn('flux-input resize-none font-mono text-xs leading-relaxed', errors.hallazgos && 'border-flux-danger')}
              placeholder="• Ausencia de proceso comercial estandarizado&#10;• Pipeline gestionado en hojas de cálculo&#10;• Sin visibilidad del ciclo de vida del cliente…"
              {...register('hallazgos')}
            />
            {errors.hallazgos && <p className="mt-1 text-2xs text-flux-danger">{errors.hallazgos.message}</p>}
          </div>

          {/* Recomendaciones */}
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">
              Recomendaciones *
              <span className="ml-2 text-flux-text3 font-normal normal-case">Qué propone Fluxtic para abordar cada hallazgo</span>
            </label>
            <textarea
              rows={5}
              className={cn('flux-input resize-none font-mono text-xs leading-relaxed', errors.recomendaciones && 'border-flux-danger')}
              placeholder="1. Implementar CRM con pipeline visual&#10;2. Definir etapas del proceso comercial&#10;3. Establecer KPIs de seguimiento mensual…"
              {...register('recomendaciones')}
            />
            {errors.recomendaciones && <p className="mt-1 text-2xs text-flux-danger">{errors.recomendaciones.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2 shrink-0">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear diagnóstico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail drawer ─────────────────────────────────────────
function DiagDrawer({ diag, leadNombre, onClose, onEdit }: {
  diag:       Diagnostico
  leadNombre: string
  onClose:    () => void
  onEdit:     () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-flux-card border-l border-flux-border h-full overflow-y-auto animate-slide-in flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-flux-border sticky top-0 bg-flux-card z-10">
          <div>
            <Badge variant={ESTADO_BADGE[diag.estado]}>{ESTADO_LABEL[diag.estado]}</Badge>
            <h2 className="font-display font-bold text-lg text-flux-white mt-2">{diag.titulo}</h2>
            <p className="text-xs text-flux-text3 mt-1">
              Lead: <span className="text-flux-teal">{leadNombre}</span>
              {' · '}
              {format(toDate(diag.creadoEn), "d 'de' MMMM yyyy", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onEdit} className="btn-ghost flex items-center gap-1.5 text-xs">
              <Pencil size={12} /> Editar
            </button>
            <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 transition-colors p-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-8 flex-1">
          <section>
            <h3 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-flux-warning inline-block" />
              Hallazgos
            </h3>
            <div className="bg-flux-surface border border-flux-border rounded-xl p-4">
              <p className="text-sm text-flux-text1 whitespace-pre-line leading-relaxed">
                {diag.hallazgos}
              </p>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-flux-teal inline-block" />
              Recomendaciones
            </h3>
            <div className="bg-flux-surface border border-flux-border rounded-xl p-4">
              <p className="text-sm text-flux-text1 whitespace-pre-line leading-relaxed">
                {diag.recomendaciones}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function DiagnosticosPage() {
  const { profile } = useAuthContext()
  const { data: diags,   loading: ld } = useCollection<Diagnostico>('diagnosticos')
  const { data: leads,   loading: ll } = useCollection<Lead>('leads')

  const [modal,    setModal]    = useState<'new' | Diagnostico | null>(null)
  const [drawer,   setDrawer]   = useState<Diagnostico | null>(null)
  const [menuId,   setMenuId]   = useState<string | null>(null)
  const [filterEst, setFilterEst] = useState<DiagnosticoEstado | 'todos'>('todos')

  const leadMap = Object.fromEntries(leads.map(l => [l.id, l]))

  const filtered = diags.filter(d =>
    filterEst === 'todos' || d.estado === filterEst
  )

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este diagnóstico?')) return
    await deleteDocById('diagnosticos', id)
    setMenuId(null)
  }

  async function handleEstado(diag: Diagnostico, estado: DiagnosticoEstado) {
    await updateDocById<Diagnostico>('diagnosticos', diag.id, { estado })
    setMenuId(null)
  }

  const loading = ld || ll

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Diagnósticos"
          subtitle={`${diags.length} diagnóstico${diags.length !== 1 ? 's' : ''} registrados`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nuevo diagnóstico
            </button>
          }
        />

        <div className="px-8 pb-10 space-y-5">
          {/* Filters */}
          <div className="flex gap-1.5 flex-wrap">
            {(['todos', ...ESTADOS] as const).map(e => (
              <button
                key={e}
                onClick={() => setFilterEst(e)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filterEst === e
                    ? 'bg-flux-teal text-flux-bg'
                    : 'bg-flux-muted text-flux-text3 hover:text-flux-text1'
                )}
              >
                {e === 'todos' ? 'Todos' : ESTADO_LABEL[e]}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center">
              <Spinner /> Cargando…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Stethoscope size={40} />}
              title="Sin diagnósticos"
              description="Los diagnósticos se crean a partir de leads calificados."
              action={
                <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
                  <Plus size={14} /> Crear diagnóstico
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(diag => {
                const lead = leadMap[diag.leadId]
                return (
                  <div
                    key={diag.id}
                    className="flux-card cursor-pointer group relative"
                    onClick={() => setDrawer(diag)}
                  >
                    {/* Estado badge */}
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant={ESTADO_BADGE[diag.estado]}>
                        {ESTADO_LABEL[diag.estado]}
                      </Badge>
                      {/* Menu */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setMenuId(menuId === diag.id ? null : diag.id)}
                          className="text-flux-text3 hover:text-flux-text1 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {menuId === diag.id && (
                          <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[160px]">
                            <div className="px-3 py-1 text-2xs text-flux-text3 border-b border-flux-border mb-1">Cambiar estado</div>
                            {ESTADOS.map(e => (
                              <button
                                key={e}
                                onClick={() => handleEstado(diag, e)}
                                className={cn(
                                  'w-full text-left px-3 py-1.5 text-xs hover:bg-flux-muted transition-colors',
                                  diag.estado === e ? 'text-flux-teal' : 'text-flux-text2'
                                )}
                              >
                                {ESTADO_LABEL[e]}
                              </button>
                            ))}
                            <div className="border-t border-flux-border mt-1 pt-1">
                              <button
                                onClick={() => { setModal(diag); setMenuId(null) }}
                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted"
                              >
                                <Pencil size={11} /> Editar
                              </button>
                              <button
                                onClick={() => handleDelete(diag.id)}
                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-danger hover:bg-flux-muted"
                              >
                                <Trash2 size={11} /> Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-medium text-flux-text1 group-hover:text-flux-white transition-colors mb-1 text-sm leading-snug">
                      {diag.titulo}
                    </h3>

                    {/* Lead */}
                    {lead && (
                      <p className="text-2xs text-flux-text3 mb-3 flex items-center gap-1">
                        <ExternalLink size={10} />
                        {lead.nombre} — {lead.empresa}
                      </p>
                    )}

                    {/* Hallazgos preview */}
                    <p className="text-xs text-flux-text3 line-clamp-3 leading-relaxed">
                      {diag.hallazgos}
                    </p>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-flux-border/50 flex items-center justify-between">
                      <span className="text-2xs text-flux-text3">
                        {format(toDate(diag.creadoEn), "d MMM yyyy", { locale: es })}
                      </span>
                      <span className="text-2xs text-flux-teal opacity-0 group-hover:opacity-100 transition-opacity">
                        Ver detalle →
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modal !== null && (
        <DiagModal
          diag={modal === 'new' ? undefined : modal}
          leads={leads}
          responsableId={profile?.uid ?? ''}
          onClose={() => setModal(null)}
        />
      )}

      {drawer && (
        <DiagDrawer
          diag={drawer}
          leadNombre={leadMap[drawer.leadId]
            ? `${leadMap[drawer.leadId].nombre} — ${leadMap[drawer.leadId].empresa}`
            : drawer.leadId}
          onClose={() => setDrawer(null)}
          onEdit={() => { setModal(drawer); setDrawer(null) }}
        />
      )}

      {menuId && <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />}
    </>
  )
}
