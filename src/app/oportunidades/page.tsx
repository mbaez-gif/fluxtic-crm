'use client'

import { useState, useRef }  from 'react'
import { useForm }            from 'react-hook-form'
import { zodResolver }        from '@hookform/resolvers/zod'
import { z }                  from 'zod'
import { useCollection }      from '@/lib/hooks/useCollection'
import { useAuthContext }     from '@/components/auth/AuthProvider'
import { createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore'
import { PageHeader }         from '@/components/layout/PageHeader'
import { Badge, Spinner }     from '@/components/ui'
import type { Oportunidad, OportunidadEtapa, Lead, Diagnostico } from '@/types'
import { cn }                 from '@/lib/utils'
import { format }             from 'date-fns'
import { es }                 from 'date-fns/locale'
import type { Timestamp }     from 'firebase/firestore'
import { Timestamp as FSTimestamp } from 'firebase/firestore'
import {
  Plus, X, TrendingUp, Pencil, Trash2,
  MoreHorizontal, GripVertical, ChevronRight,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────
const ETAPAS: OportunidadEtapa[] = ['analisis', 'propuesta', 'negociacion', 'ganada', 'perdida']

const ETAPA_META: Record<OportunidadEtapa, {
  label: string
  color: string
  badge: 'default' | 'info' | 'warning' | 'teal' | 'danger'
  dot:   string
}> = {
  analisis:    { label: 'Análisis',     color: 'border-t-flux-info',    badge: 'info',    dot: 'bg-flux-info'    },
  propuesta:   { label: 'Propuesta',    color: 'border-t-flux-warning', badge: 'warning', dot: 'bg-flux-warning' },
  negociacion: { label: 'Negociación',  color: 'border-t-amber-400',    badge: 'warning', dot: 'bg-amber-400'    },
  ganada:      { label: 'Ganada',       color: 'border-t-flux-teal',    badge: 'teal',    dot: 'bg-flux-teal'    },
  perdida:     { label: 'Perdida',      color: 'border-t-flux-danger',  badge: 'danger',  dot: 'bg-flux-danger'  },
}

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

// ── Schema ────────────────────────────────────────────────
const schema = z.object({
  titulo:          z.string().min(3, 'Requerido'),
  leadId:          z.string().min(1, 'Selecciona un lead'),
  diagnosticoId:   z.string().optional(),
  valorEstimado:   z.coerce.number().min(0, 'Debe ser mayor a 0'),
  probabilidad:    z.coerce.number().min(0).max(100),
  etapa:           z.enum(['analisis', 'propuesta', 'negociacion', 'ganada', 'perdida']),
  cierreEstimado:  z.string().min(1, 'Selecciona una fecha'),
  notas:           z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// ── Modal ─────────────────────────────────────────────────
function OpoModal({
  opo, leads, diagnosticos, responsableId, defaultEtapa, onClose,
}: {
  opo?:           Oportunidad
  leads:          Lead[]
  diagnosticos:   Diagnostico[]
  responsableId:  string
  defaultEtapa?:  OportunidadEtapa
  onClose:        () => void
}) {
  const isEdit = !!opo
  const {
    register, handleSubmit, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: opo
      ? {
          titulo:         opo.titulo,
          leadId:         opo.leadId,
          diagnosticoId:  opo.diagnosticoId ?? '',
          valorEstimado:  opo.valorEstimado,
          probabilidad:   opo.probabilidad,
          etapa:          opo.etapa,
          cierreEstimado: format(toDate(opo.cierreEstimado), 'yyyy-MM-dd'),
          notas:          opo.notas ?? '',
        }
      : {
          etapa:        defaultEtapa ?? 'analisis',
          probabilidad: 20,
        },
  })

  const selectedLeadId = watch('leadId')
  const diagsForLead = diagnosticos.filter(d => d.leadId === selectedLeadId)

  async function onSubmit(values: FormValues) {
    const { cierreEstimado, ...rest } = values
    const payload = {
      ...rest,
      cierreEstimado: FSTimestamp.fromDate(new Date(cierreEstimado)),
      responsableId,
    }
    if (isEdit && opo) {
      await updateDocById<Oportunidad>('oportunidades', opo.id, payload)
    } else {
      await createDoc<Oportunidad>('oportunidades', payload)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-flux-border shrink-0">
          <h2 className="font-display font-bold text-base text-flux-white">
            {isEdit ? 'Editar oportunidad' : 'Nueva oportunidad'}
          </h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Título *</label>
            <input
              className={cn('flux-input', errors.titulo && 'border-flux-danger')}
              placeholder="Ej: Consultoría transformación digital"
              {...register('titulo')}
            />
            {errors.titulo && <p className="mt-1 text-2xs text-flux-danger">{errors.titulo.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Lead *</label>
              <select className={cn('flux-input', errors.leadId && 'border-flux-danger')} {...register('leadId')}>
                <option value="">Selecciona…</option>
                {leads.filter(l => l.estado !== 'descartado').map(l => (
                  <option key={l.id} value={l.id}>{l.nombre} — {l.empresa}</option>
                ))}
              </select>
              {errors.leadId && <p className="mt-1 text-2xs text-flux-danger">{errors.leadId.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Diagnóstico</label>
              <select className="flux-input" {...register('diagnosticoId')}>
                <option value="">Sin diagnóstico</option>
                {diagsForLead.map(d => (
                  <option key={d.id} value={d.id}>{d.titulo}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Valor estimado (€) *</label>
              <input
                type="number"
                min="0"
                className={cn('flux-input', errors.valorEstimado && 'border-flux-danger')}
                placeholder="5000"
                {...register('valorEstimado')}
              />
              {errors.valorEstimado && <p className="mt-1 text-2xs text-flux-danger">{errors.valorEstimado.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Probabilidad (%)</label>
              <input
                type="number"
                min="0" max="100"
                className="flux-input"
                placeholder="50"
                {...register('probabilidad')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Etapa *</label>
              <select className="flux-input" {...register('etapa')}>
                {ETAPAS.map(e => (
                  <option key={e} value={e}>{ETAPA_META[e].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Cierre estimado *</label>
              <input
                type="date"
                className={cn('flux-input', errors.cierreEstimado && 'border-flux-danger')}
                {...register('cierreEstimado')}
              />
              {errors.cierreEstimado && <p className="mt-1 text-2xs text-flux-danger">{errors.cierreEstimado.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Notas</label>
            <textarea
              rows={3}
              className="flux-input resize-none"
              placeholder="Contexto, condiciones especiales, próximos pasos…"
              {...register('notas')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear oportunidad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Kanban Card ───────────────────────────────────────────
function OpoCard({
  opo, leadNombre, onEdit, onDelete, onMove,
}: {
  opo:       Oportunidad
  leadNombre: string
  onEdit:    () => void
  onDelete:  () => void
  onMove:    (etapa: OportunidadEtapa) => void
}) {
  const [menu, setMenu] = useState(false)
  const prob = opo.probabilidad ?? 0

  return (
    <div className="bg-flux-surface border border-flux-border rounded-xl p-4 group hover:border-flux-muted transition-all shadow-card hover:shadow-card-hover">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-flux-text1 group-hover:text-flux-white transition-colors leading-snug flex-1">
          {opo.titulo}
        </p>
        <div className="relative shrink-0">
          <button
            onClick={() => setMenu(m => !m)}
            className="text-flux-text3 hover:text-flux-text1 transition-colors opacity-0 group-hover:opacity-100 p-0.5 rounded"
          >
            <MoreHorizontal size={14} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[160px]">
                <p className="px-3 py-1 text-2xs text-flux-text3 border-b border-flux-border mb-1">Mover a</p>
                {ETAPAS.filter(e => e !== opo.etapa).map(e => (
                  <button key={e} onClick={() => { onMove(e); setMenu(false) }}
                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted transition-colors">
                    <span className={cn('w-1.5 h-1.5 rounded-full', ETAPA_META[e].dot)} />
                    {ETAPA_META[e].label}
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

      {/* Lead */}
      <p className="text-2xs text-flux-text3 mb-3">{leadNombre}</p>

      {/* Probability bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-2xs text-flux-text3">Probabilidad</span>
          <span className="text-2xs font-medium text-flux-text2">{prob}%</span>
        </div>
        <div className="w-full h-1 bg-flux-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${prob}%`,
              background: prob >= 70
                ? 'var(--tw-colors-flux-teal, #00D4A8)'
                : prob >= 40
                ? '#F59E0B'
                : '#6B7599',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-flux-teal">
          €{(opo.valorEstimado ?? 0).toLocaleString('es-ES')}
        </span>
        <span className="text-2xs text-flux-text3">
          {format(toDate(opo.cierreEstimado), "d MMM", { locale: es })}
        </span>
      </div>
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────
function KanbanColumn({
  etapa, opors, leadMap, onAdd, onEdit, onDelete,
}: {
  etapa:   OportunidadEtapa
  opors:   Oportunidad[]
  leadMap: Record<string, Lead>
  onAdd:   () => void
  onEdit:  (o: Oportunidad) => void
  onDelete:(id: string) => void
}) {
  const meta  = ETAPA_META[etapa]
  const total = opors.reduce((acc, o) => acc + (o.valorEstimado ?? 0), 0)

  async function handleMove(opo: Oportunidad, newEtapa: OportunidadEtapa) {
    await updateDocById<Oportunidad>('oportunidades', opo.id, { etapa: newEtapa })
  }

  return (
    <div className="flex flex-col min-w-[260px] max-w-[260px]">
      {/* Column header */}
      <div className={cn(
        'bg-flux-card border border-flux-border rounded-t-xl px-4 py-3 border-t-2',
        meta.color
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
            <span className="text-xs font-semibold text-flux-text1">{meta.label}</span>
            <span className="text-2xs text-flux-text3 bg-flux-muted px-1.5 py-0.5 rounded-full">
              {opors.length}
            </span>
          </div>
          <button
            onClick={onAdd}
            className="text-flux-text3 hover:text-flux-teal transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        {total > 0 && (
          <p className="text-xs font-medium text-flux-teal mt-1.5">
            €{total.toLocaleString('es-ES')}
          </p>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 bg-flux-surface/50 border-x border-b border-flux-border rounded-b-xl p-2 space-y-2 min-h-[200px]">
        {opors.map(opo => (
          <OpoCard
            key={opo.id}
            opo={opo}
            leadNombre={
              leadMap[opo.leadId]
                ? `${leadMap[opo.leadId].nombre} — ${leadMap[opo.leadId].empresa}`
                : '—'
            }
            onEdit={() => onEdit(opo)}
            onDelete={() => onDelete(opo.id)}
            onMove={newEtapa => handleMove(opo, newEtapa)}
          />
        ))}
        {opors.length === 0 && (
          <button
            onClick={onAdd}
            className="w-full border border-dashed border-flux-border rounded-xl p-4 text-xs text-flux-text3 hover:text-flux-text2 hover:border-flux-muted transition-colors text-center"
          >
            + Añadir oportunidad
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function OportunidadesPage() {
  const { profile } = useAuthContext()
  const { data: opors,   loading: lo } = useCollection<Oportunidad>('oportunidades')
  const { data: leads,   loading: ll } = useCollection<Lead>('leads')
  const { data: diags,   loading: ld } = useCollection<Diagnostico>('diagnosticos')

  const [modal, setModal] = useState<'new' | { opo?: Oportunidad; etapa?: OportunidadEtapa } | null>(null)

  const leadMap = Object.fromEntries(leads.map(l => [l.id, l]))

  const pipelineTotal = opors
    .filter(o => !['ganada', 'perdida'].includes(o.etapa))
    .reduce((acc, o) => acc + (o.valorEstimado ?? 0), 0)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta oportunidad?')) return
    await deleteDocById('oportunidades', id)
  }

  const loading = lo || ll || ld

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Pipeline"
          subtitle={`€${pipelineTotal.toLocaleString('es-ES')} en pipeline activo · ${opors.length} oportunidades`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nueva oportunidad
            </button>
          }
        />

        <div className="px-8 pb-10">
          {loading ? (
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center">
              <Spinner /> Cargando pipeline…
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-4">
              {ETAPAS.map(etapa => (
                <KanbanColumn
                  key={etapa}
                  etapa={etapa}
                  opors={opors.filter(o => o.etapa === etapa)}
                  leadMap={leadMap}
                  onAdd={() => setModal({ etapa })}
                  onEdit={opo => setModal({ opo })}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {modal !== null && (
        <OpoModal
          opo={modal === 'new' ? undefined : (modal as { opo?: Oportunidad }).opo}
          leads={leads}
          diagnosticos={diags}
          responsableId={profile?.uid ?? ''}
          defaultEtapa={modal === 'new' ? 'analisis' : (modal as { etapa?: OportunidadEtapa }).etapa}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
