'use client'

import { useState }       from 'react'
import { useForm }        from 'react-hook-form'
import { zodResolver }    from '@hookform/resolvers/zod'
import { z }              from 'zod'
import { useCollection }  from '@/lib/hooks/useCollection'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore'
import { PageHeader }     from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import type { Lead, LeadEstado, LeadFuente } from '@/types'
import { cn }             from '@/lib/utils'
import { format }         from 'date-fns'
import { es }             from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'
import {
  Plus, Search, X, Users, MoreHorizontal,
  Pencil, Trash2, ChevronDown,
} from 'lucide-react'

// ── Schema ────────────────────────────────────────────────
const schema = z.object({
  nombre:   z.string().min(2, 'Requerido'),
  empresa:  z.string().min(1, 'Requerido'),
  email:    z.string().email('Email inválido'),
  telefono: z.string().optional(),
  fuente:   z.enum(['referido', 'web', 'evento', 'outbound', 'otro']),
  estado:   z.enum(['nuevo', 'contactado', 'calificado', 'descartado']),
  notas:    z.string().optional(),
})
type FormValues = z.infer<typeof schema>

// ── Constants ─────────────────────────────────────────────
const FUENTES: LeadFuente[] = ['referido', 'web', 'evento', 'outbound', 'otro']
const ESTADOS: LeadEstado[] = ['nuevo', 'contactado', 'calificado', 'descartado']

const ESTADO_BADGE: Record<LeadEstado, 'default' | 'teal' | 'warning' | 'danger' | 'info'> = {
  nuevo:       'default',
  contactado:  'info',
  calificado:  'teal',
  descartado:  'danger',
}

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

// ── Modal ─────────────────────────────────────────────────
function LeadModal({
  lead,
  responsableId,
  onClose,
}: {
  lead?:         Lead
  responsableId: string
  onClose:       () => void
}) {
  const isEdit = !!lead

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: lead
      ? {
          nombre:   lead.nombre,
          empresa:  lead.empresa,
          email:    lead.email,
          telefono: lead.telefono ?? '',
          fuente:   lead.fuente,
          estado:   lead.estado,
          notas:    lead.notas ?? '',
        }
      : {
          estado: 'nuevo',
          fuente: 'web',
        },
  })

  async function onSubmit(values: FormValues) {
    if (isEdit && lead) {
      await updateDocById<Lead>('leads', lead.id, values)
    } else {
      await createDoc<Lead>('leads', { ...values, responsableId })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-flux-border">
          <h2 className="font-display font-bold text-base text-flux-white">
            {isEdit ? 'Editar lead' : 'Nuevo lead'}
          </h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Nombre *</label>
              <input className={cn('flux-input', errors.nombre && 'border-flux-danger')} placeholder="Ana García" {...register('nombre')} />
              {errors.nombre && <p className="mt-1 text-2xs text-flux-danger">{errors.nombre.message}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Empresa *</label>
              <input className={cn('flux-input', errors.empresa && 'border-flux-danger')} placeholder="Acme S.L." {...register('empresa')} />
              {errors.empresa && <p className="mt-1 text-2xs text-flux-danger">{errors.empresa.message}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Email *</label>
              <input type="email" className={cn('flux-input', errors.email && 'border-flux-danger')} placeholder="ana@acme.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-2xs text-flux-danger">{errors.email.message}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Teléfono</label>
              <input className="flux-input" placeholder="+34 600 000 000" {...register('telefono')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Fuente *</label>
              <select className="flux-input" {...register('fuente')}>
                {FUENTES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado *</label>
              <select className="flux-input" {...register('estado')}>
                {ESTADOS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Notas</label>
              <textarea
                rows={3}
                className="flux-input resize-none"
                placeholder="Contexto, referencia, próximos pasos…"
                {...register('notas')}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function LeadsPage() {
  const { profile }   = useAuthContext()
  const { data: leads, loading } = useCollection<Lead>('leads')

  const [search,    setSearch]    = useState('')
  const [filterEst, setFilterEst] = useState<LeadEstado | 'todos'>('todos')
  const [modal,     setModal]     = useState<'new' | Lead | null>(null)
  const [menuId,    setMenuId]    = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<string | null>(null)

  const filtered = leads.filter(l => {
    const matchSearch = !search ||
      l.nombre.toLowerCase().includes(search.toLowerCase()) ||
      l.empresa.toLowerCase().includes(search.toLowerCase()) ||
      l.email.toLowerCase().includes(search.toLowerCase())
    const matchEst = filterEst === 'todos' || l.estado === filterEst
    return matchSearch && matchEst
  })

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este lead?')) return
    setDeleting(id)
    await deleteDocById('leads', id)
    setDeleting(null)
    setMenuId(null)
  }

  async function handleEstadoChange(lead: Lead, estado: LeadEstado) {
    await updateDocById<Lead>('leads', lead.id, { estado })
    setMenuId(null)
  }

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Leads"
          subtitle={`${leads.length} contacto${leads.length !== 1 ? 's' : ''} en total`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nuevo lead
            </button>
          }
        />

        <div className="px-8 pb-10 space-y-5">

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3" />
              <input
                className="flux-input pl-9"
                placeholder="Buscar por nombre, empresa o email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-flux-text3 hover:text-flux-text1"
                >
                  <X size={12} />
                </button>
              )}
            </div>
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
                  {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center">
              <Spinner /> Cargando leads…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users size={40} />}
              title={search || filterEst !== 'todos' ? 'Sin resultados' : 'Sin leads todavía'}
              description={
                search || filterEst !== 'todos'
                  ? 'Prueba con otros filtros'
                  : 'Crea tu primer lead para empezar a gestionar el pipeline'
              }
              action={
                !search && filterEst === 'todos' ? (
                  <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
                    <Plus size={14} /> Crear lead
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="flux-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Nombre', 'Empresa', 'Fuente', 'Estado', 'Creado', ''].map(h => (
                      <th
                        key={h}
                        className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lead => (
                    <tr key={lead.id} className="border-b border-flux-border/50 hover:bg-flux-muted/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-flux-muted flex items-center justify-center text-2xs font-medium text-flux-teal shrink-0">
                            {lead.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-flux-text1">{lead.nombre}</p>
                            <p className="text-2xs text-flux-text3">{lead.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-flux-text2">{lead.empresa}</td>
                      <td className="px-4 py-3">
                        <span className="text-2xs text-flux-text3 capitalize">{lead.fuente}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setMenuId(menuId === `est-${lead.id}` ? null : `est-${lead.id}`)}
                            className="flex items-center gap-1"
                          >
                            <Badge variant={ESTADO_BADGE[lead.estado]}>
                              {lead.estado}
                            </Badge>
                            <ChevronDown size={10} className="text-flux-text3" />
                          </button>
                          {menuId === `est-${lead.id}` && (
                            <div className="absolute top-full left-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[140px]">
                              {ESTADOS.map(e => (
                                <button
                                  key={e}
                                  onClick={() => handleEstadoChange(lead, e)}
                                  className={cn(
                                    'w-full text-left px-3 py-1.5 text-xs hover:bg-flux-muted transition-colors capitalize',
                                    lead.estado === e ? 'text-flux-teal' : 'text-flux-text2'
                                  )}
                                >
                                  {e}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-2xs text-flux-text3">
                        {format(toDate(lead.creadoEn), "d MMM yy", { locale: es })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative flex justify-end">
                          <button
                            onClick={() => setMenuId(menuId === lead.id ? null : lead.id)}
                            className="text-flux-text3 hover:text-flux-text1 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                          {menuId === lead.id && (
                            <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[130px]">
                              <button
                                onClick={() => { setModal(lead); setMenuId(null) }}
                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted hover:text-flux-text1 transition-colors"
                              >
                                <Pencil size={12} /> Editar
                              </button>
                              <button
                                onClick={() => handleDelete(lead.id)}
                                disabled={deleting === lead.id}
                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-danger hover:bg-flux-muted transition-colors"
                              >
                                <Trash2 size={12} />
                                {deleting === lead.id ? 'Eliminando…' : 'Eliminar'}
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

      {/* Modal */}
      {modal !== null && (
        <LeadModal
          lead={modal === 'new' ? undefined : modal}
          responsableId={profile?.uid ?? ''}
          onClose={() => setModal(null)}
        />
      )}

      {/* Close dropdowns on outside click */}
      {menuId && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
      )}
    </>
  )
}
