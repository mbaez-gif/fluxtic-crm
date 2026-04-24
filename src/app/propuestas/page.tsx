'use client'

import { useState }        from 'react'
import { useForm }         from 'react-hook-form'
import { zodResolver }     from '@hookform/resolvers/zod'
import { z }               from 'zod'
import { useCollection }   from '@/lib/hooks/useCollection'
import { useAuthContext }  from '@/components/auth/AuthProvider'
import { createDoc, updateDocById, deleteDocById, readDocs } from '@/lib/firebase/firestore'
import { PageHeader }      from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import type { Propuesta, PropuestaEstado, Oportunidad, Cliente } from '@/types'
import { cn }              from '@/lib/utils'
import { format }          from 'date-fns'
import { es }              from 'date-fns/locale'
import type { Timestamp }  from 'firebase/firestore'
import {
  Plus, X, FileText, Pencil, Trash2,
  MoreHorizontal, CheckCircle, XCircle,
  Send, Copy, ExternalLink,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────
const ESTADOS: PropuestaEstado[] = ['borrador', 'enviada', 'aceptada', 'rechazada']

const ESTADO_META: Record<PropuestaEstado, {
  label:  string
  badge:  'default' | 'info' | 'teal' | 'danger'
  icon:   React.ReactNode
}> = {
  borrador:   { label: 'Borrador',  badge: 'default', icon: <FileText size={12} />     },
  enviada:    { label: 'Enviada',   badge: 'info',    icon: <Send size={12} />         },
  aceptada:   { label: 'Aceptada', badge: 'teal',    icon: <CheckCircle size={12} />  },
  rechazada:  { label: 'Rechazada',badge: 'danger',   icon: <XCircle size={12} />      },
}

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

// ── Schema ────────────────────────────────────────────────
const schema = z.object({
  oportunidadId: z.string().min(1, 'Selecciona una oportunidad'),
  titulo:        z.string().min(3, 'Requerido'),
  alcance:       z.string().min(20, 'Describe el alcance detalladamente'),
  entregables:   z.string().min(5, 'Lista los entregables'),
  monto:         z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
  moneda:        z.string().default('EUR'),
  condiciones:   z.string().min(5, 'Define las condiciones'),
  estado:        z.enum(['borrador', 'enviada', 'aceptada', 'rechazada']),
})
type FormValues = z.infer<typeof schema>

// ── Modal ─────────────────────────────────────────────────
function PropuestaModal({
  propuesta, opors, onClose,
}: {
  propuesta?:    Propuesta
  opors:         Oportunidad[]
  onClose:       () => void
}) {
  const isEdit = !!propuesta
  const {
    register, handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: propuesta
      ? {
          oportunidadId: propuesta.oportunidadId,
          titulo:        propuesta.titulo,
          alcance:       propuesta.alcance,
          entregables:   propuesta.entregables.join('\n'),
          monto:         propuesta.monto,
          moneda:        propuesta.moneda,
          condiciones:   propuesta.condiciones,
          estado:        propuesta.estado,
        }
      : {
          estado:  'borrador',
          moneda:  'EUR',
        },
  })

  async function onSubmit(values: FormValues) {
    const entregables = values.entregables
      .split('\n')
      .map(e => e.trim())
      .filter(Boolean)

    if (isEdit && propuesta) {
      await updateDocById<Propuesta>('propuestas', propuesta.id, {
        ...values,
        entregables,
        version: (propuesta.version ?? 1) + 1,
      })
    } else {
      // Contar versiones existentes para esa oportunidad
      const existing = await readDocs<Propuesta>('propuestas', [
        { field: 'oportunidadId', op: '==', value: values.oportunidadId }
      ])
      await createDoc<Propuesta>('propuestas', {
        ...values,
        entregables,
        version: existing.length + 1,
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-flux-border shrink-0">
          <h2 className="font-display font-bold text-base text-flux-white">
            {isEdit ? 'Editar propuesta' : 'Nueva propuesta'}
          </h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Oportunidad */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Oportunidad *</label>
              <select className={cn('flux-input', errors.oportunidadId && 'border-flux-danger')} {...register('oportunidadId')}>
                <option value="">Selecciona…</option>
                {opors.filter(o => !['ganada', 'perdida'].includes(o.etapa)).map(o => (
                  <option key={o.id} value={o.id}>{o.titulo}</option>
                ))}
              </select>
              {errors.oportunidadId && <p className="mt-1 text-2xs text-flux-danger">{errors.oportunidadId.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado *</label>
              <select className="flux-input" {...register('estado')}>
                {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_META[e].label}</option>)}
              </select>
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Título *</label>
            <input
              className={cn('flux-input', errors.titulo && 'border-flux-danger')}
              placeholder="Ej: Propuesta de consultoría en procesos — Acme S.L."
              {...register('titulo')}
            />
            {errors.titulo && <p className="mt-1 text-2xs text-flux-danger">{errors.titulo.message}</p>}
          </div>

          {/* Monto + Moneda */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Monto *</label>
              <input
                type="number" min="0"
                className={cn('flux-input', errors.monto && 'border-flux-danger')}
                placeholder="12000"
                {...register('monto')}
              />
              {errors.monto && <p className="mt-1 text-2xs text-flux-danger">{errors.monto.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Moneda</label>
              <select className="flux-input" {...register('moneda')}>
                <option value="EUR">EUR €</option>
                <option value="USD">USD $</option>
                <option value="GBP">GBP £</option>
              </select>
            </div>
          </div>

          {/* Alcance */}
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">
              Alcance *
              <span className="ml-2 text-flux-text3 font-normal normal-case">Qué incluye el servicio</span>
            </label>
            <textarea
              rows={4}
              className={cn('flux-input resize-none text-xs leading-relaxed', errors.alcance && 'border-flux-danger')}
              placeholder="Descripción detallada del alcance del servicio, fases, metodología…"
              {...register('alcance')}
            />
            {errors.alcance && <p className="mt-1 text-2xs text-flux-danger">{errors.alcance.message}</p>}
          </div>

          {/* Entregables */}
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">
              Entregables *
              <span className="ml-2 text-flux-text3 font-normal normal-case">Un entregable por línea</span>
            </label>
            <textarea
              rows={4}
              className={cn('flux-input resize-none font-mono text-xs leading-relaxed', errors.entregables && 'border-flux-danger')}
              placeholder="Diagnóstico de situación actual&#10;Plan de acción con hoja de ruta&#10;Sesión de formación al equipo (4h)&#10;Informe ejecutivo final"
              {...register('entregables')}
            />
            {errors.entregables && <p className="mt-1 text-2xs text-flux-danger">{errors.entregables.message}</p>}
          </div>

          {/* Condiciones */}
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">
              Condiciones *
              <span className="ml-2 text-flux-text3 font-normal normal-case">Pago, plazos, exclusiones</span>
            </label>
            <textarea
              rows={3}
              className={cn('flux-input resize-none text-xs leading-relaxed', errors.condiciones && 'border-flux-danger')}
              placeholder="50% al inicio del proyecto, 50% a la entrega. Validez 30 días. Excluye desplazamientos…"
              {...register('condiciones')}
            />
            {errors.condiciones && <p className="mt-1 text-2xs text-flux-danger">{errors.condiciones.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear propuesta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Detail drawer ─────────────────────────────────────────
function PropuestaDrawer({
  propuesta, opoNombre, onClose, onEdit, onStatusChange,
}: {
  propuesta:      Propuesta
  opoNombre:      string
  onClose:        () => void
  onEdit:         () => void
  onStatusChange: (estado: PropuestaEstado) => void
}) {
  const meta = ESTADO_META[propuesta.estado]
  const montoStr = `${propuesta.monto.toLocaleString('es-ES')} ${propuesta.moneda}`

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-flux-card border-l border-flux-border h-full overflow-y-auto animate-slide-in">
        {/* Header */}
        <div className="sticky top-0 bg-flux-card border-b border-flux-border px-6 py-5 z-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant={meta.badge}>{meta.label}</Badge>
                <span className="text-2xs text-flux-text3">v{propuesta.version}</span>
              </div>
              <h2 className="font-display font-bold text-lg text-flux-white leading-tight">
                {propuesta.titulo}
              </h2>
              <p className="text-xs text-flux-text3 mt-1 flex items-center gap-1">
                <ExternalLink size={10} /> {opoNombre}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={onEdit} className="btn-ghost flex items-center gap-1.5 text-xs">
                <Pencil size={12} /> Editar
              </button>
              <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 p-1">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Monto destacado */}
          <div className="mt-4 flex items-center gap-6">
            <div>
              <p className="text-2xs text-flux-text3 mb-1">Importe</p>
              <p className="font-display text-2xl font-bold text-flux-teal">{montoStr}</p>
            </div>
            <div>
              <p className="text-2xs text-flux-text3 mb-1">Creada</p>
              <p className="text-sm text-flux-text1">
                {format(toDate(propuesta.creadoEn), "d MMM yyyy", { locale: es })}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-6">
          {/* Quick status change */}
          <div>
            <p className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-2">Cambiar estado</p>
            <div className="flex gap-2 flex-wrap">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  onClick={() => onStatusChange(e)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                    propuesta.estado === e
                      ? 'border-flux-teal bg-flux-tealGlow text-flux-teal'
                      : 'border-flux-border bg-flux-surface text-flux-text3 hover:text-flux-text1 hover:border-flux-muted'
                  )}
                >
                  {ESTADO_META[e].icon}
                  {ESTADO_META[e].label}
                </button>
              ))}
            </div>
          </div>

          {/* Alcance */}
          <section>
            <h3 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">Alcance</h3>
            <div className="bg-flux-surface border border-flux-border rounded-xl p-4">
              <p className="text-sm text-flux-text1 whitespace-pre-line leading-relaxed">{propuesta.alcance}</p>
            </div>
          </section>

          {/* Entregables */}
          <section>
            <h3 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">Entregables</h3>
            <ul className="space-y-2">
              {propuesta.entregables.map((e, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-flux-text1">
                  <span className="w-5 h-5 rounded-full bg-flux-tealGlow text-flux-teal text-2xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {e}
                </li>
              ))}
            </ul>
          </section>

          {/* Condiciones */}
          <section>
            <h3 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">Condiciones</h3>
            <div className="bg-flux-surface border border-flux-border rounded-xl p-4">
              <p className="text-sm text-flux-text1 whitespace-pre-line leading-relaxed">{propuesta.condiciones}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function PropuestasPage() {
  const { data: propuestas, loading: lp } = useCollection<Propuesta>('propuestas')
  const { data: opors,      loading: lo } = useCollection<Oportunidad>('oportunidades')

  const [modal,    setModal]    = useState<'new' | Propuesta | null>(null)
  const [drawer,   setDrawer]   = useState<Propuesta | null>(null)
  const [filterEst,setFilterEst]= useState<PropuestaEstado | 'todos'>('todos')
  const [menuId,   setMenuId]   = useState<string | null>(null)

  const opoMap = Object.fromEntries(opors.map(o => [o.id, o]))

  const filtered = propuestas.filter(p =>
    filterEst === 'todos' || p.estado === filterEst
  )

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta propuesta?')) return
    await deleteDocById('propuestas', id)
    setMenuId(null)
    if (drawer?.id === id) setDrawer(null)
  }

  async function handleStatusChange(propuesta: Propuesta, estado: PropuestaEstado) {
    await updateDocById<Propuesta>('propuestas', propuesta.id, { estado })
    // Actualizar el drawer si está abierto
    setDrawer(prev => prev?.id === propuesta.id ? { ...prev, estado } : prev)
  }

  const loading = lp || lo

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Propuestas"
          subtitle={`${propuestas.length} propuesta${propuestas.length !== 1 ? 's' : ''} · ${propuestas.filter(p => p.estado === 'aceptada').length} aceptadas`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nueva propuesta
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
                {e === 'todos' ? 'Todas' : ESTADO_META[e as PropuestaEstado].label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center">
              <Spinner /> Cargando…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<FileText size={40} />}
              title="Sin propuestas"
              description="Crea propuestas a partir de las oportunidades activas del pipeline."
              action={
                <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
                  <Plus size={14} /> Crear propuesta
                </button>
              }
            />
          ) : (
            <div className="flux-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Propuesta', 'Oportunidad', 'Importe', 'Estado', 'Versión', 'Fecha', ''].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(prop => {
                    const meta = ESTADO_META[prop.estado]
                    const opo  = opoMap[prop.oportunidadId]
                    return (
                      <tr
                        key={prop.id}
                        className="border-b border-flux-border/50 hover:bg-flux-muted/30 transition-colors group cursor-pointer"
                        onClick={() => setDrawer(prop)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-flux-text1 group-hover:text-flux-white transition-colors">
                            {prop.titulo}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-flux-text3 text-xs">
                          {opo?.titulo ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-flux-teal">
                          {prop.monto.toLocaleString('es-ES')} {prop.moneda}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={meta.badge}>{meta.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-flux-text3 text-xs text-center">
                          v{prop.version}
                        </td>
                        <td className="px-4 py-3 text-2xs text-flux-text3">
                          {format(toDate(prop.creadoEn), "d MMM yy", { locale: es })}
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <div className="relative flex justify-end">
                            <button
                              onClick={() => setMenuId(menuId === prop.id ? null : prop.id)}
                              className="text-flux-text2 hover:text-flux-white transition-colors p-1 rounded"
                            >
                              <MoreHorizontal size={15} />
                            </button>
                            {menuId === prop.id && (
                              <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[130px]">
                                <button
                                  onClick={() => { setModal(prop); setMenuId(null) }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted"
                                >
                                  <Pencil size={12} /> Editar
                                </button>
                                <button
                                  onClick={() => handleDelete(prop.id)}
                                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-danger hover:bg-flux-muted"
                                >
                                  <Trash2 size={12} /> Eliminar
                                </button>
                              </div>
                            )}
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

      {modal !== null && (
        <PropuestaModal
          propuesta={modal === 'new' ? undefined : modal}
          opors={opors}
          onClose={() => setModal(null)}
        />
      )}

      {drawer && (
        <PropuestaDrawer
          propuesta={drawer}
          opoNombre={opoMap[drawer.oportunidadId]?.titulo ?? '—'}
          onClose={() => setDrawer(null)}
          onEdit={() => { setModal(drawer); setDrawer(null) }}
          onStatusChange={estado => handleStatusChange(drawer, estado)}
        />
      )}

      {menuId && <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />}
    </>
  )
}
