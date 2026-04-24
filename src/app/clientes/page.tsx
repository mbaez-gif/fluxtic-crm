'use client'

import { useState }        from 'react'
import { useForm }         from 'react-hook-form'
import { zodResolver }     from '@hookform/resolvers/zod'
import { z }               from 'zod'
import { useCollection }   from '@/lib/hooks/useCollection'
import { createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore'
import { PageHeader }      from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import type { Cliente, ClienteEstado, Oportunidad } from '@/types'
import { cn }              from '@/lib/utils'
import { format }          from 'date-fns'
import { es }              from 'date-fns/locale'
import type { Timestamp }  from 'firebase/firestore'
import Link                from 'next/link'
import {
  Plus, X, Building2, Pencil, Trash2,
  MoreHorizontal, Mail, Phone, ExternalLink, User,
} from 'lucide-react'

const ESTADOS: ClienteEstado[] = ['activo', 'inactivo', 'churned']
const ESTADO_BADGE: Record<ClienteEstado, 'teal' | 'default' | 'danger'> = {
  activo:   'teal',
  inactivo: 'default',
  churned:  'danger',
}

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

const contactoSchema = z.object({
  nombre:    z.string().min(1, 'Requerido'),
  email:     z.string().email('Email inválido'),
  cargo:     z.string().optional(),
  telefono:  z.string().optional(),
})

const schema = z.object({
  nombre:        z.string().min(2, 'Requerido'),
  empresa:       z.string().min(1, 'Requerido'),
  email:         z.string().email('Email inválido'),
  sector:        z.string().optional(),
  estado:        z.enum(['activo', 'inactivo', 'churned']),
  oportunidadId: z.string().optional(),
  contactos:     z.array(contactoSchema).default([]),
})
type FormValues = z.infer<typeof schema>

// ── Modal ─────────────────────────────────────────────────
function ClienteModal({
  cliente, opors, onClose,
}: {
  cliente?: Cliente
  opors:    Oportunidad[]
  onClose:  () => void
}) {
  const isEdit = !!cliente
  const [contactos, setContactos] = useState(cliente?.contactos ?? [])
  const [nuevoContacto, setNuevoContacto] = useState({ nombre: '', email: '', cargo: '', telefono: '' })

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: cliente
      ? { ...cliente, contactos: cliente.contactos }
      : { estado: 'activo', contactos: [] },
  })

  function addContacto() {
    if (!nuevoContacto.nombre || !nuevoContacto.email) return
    setContactos(prev => [...prev, nuevoContacto])
    setNuevoContacto({ nombre: '', email: '', cargo: '', telefono: '' })
  }

  function removeContacto(i: number) {
    setContactos(prev => prev.filter((_, idx) => idx !== i))
  }

  async function onSubmit(values: FormValues) {
    const payload = { ...values, contactos }
    if (isEdit && cliente) {
      await updateDocById<Cliente>('clientes', cliente.id, payload)
    } else {
      await createDoc<Cliente>('clientes', payload)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-flux-border shrink-0">
          <h2 className="font-display font-bold text-base text-flux-white">
            {isEdit ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-5 overflow-y-auto">
          {/* Datos principales */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Nombre *</label>
              <input className={cn('flux-input', errors.nombre && 'border-flux-danger')} placeholder="Ana García" {...register('nombre')} />
              {errors.nombre && <p className="mt-1 text-2xs text-flux-danger">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Empresa *</label>
              <input className={cn('flux-input', errors.empresa && 'border-flux-danger')} placeholder="Acme S.L." {...register('empresa')} />
              {errors.empresa && <p className="mt-1 text-2xs text-flux-danger">{errors.empresa.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Email *</label>
              <input type="email" className={cn('flux-input', errors.email && 'border-flux-danger')} placeholder="ana@acme.com" {...register('email')} />
              {errors.email && <p className="mt-1 text-2xs text-flux-danger">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Sector</label>
              <input className="flux-input" placeholder="Tecnología, Retail, Salud…" {...register('sector')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado *</label>
              <select className="flux-input" {...register('estado')}>
                {ESTADOS.map(e => <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Oportunidad origen</label>
              <select className="flux-input" {...register('oportunidadId')}>
                <option value="">Sin vincular</option>
                {opors.filter(o => o.etapa === 'ganada').map(o => (
                  <option key={o.id} value={o.id}>{o.titulo}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Contactos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-flux-text2">Contactos de la empresa</label>
              <span className="text-2xs text-flux-text3">{contactos.length} contacto{contactos.length !== 1 ? 's' : ''}</span>
            </div>

            {contactos.length > 0 && (
              <div className="space-y-2 mb-3">
                {contactos.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 bg-flux-surface border border-flux-border rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-flux-muted flex items-center justify-center text-2xs text-flux-teal shrink-0">
                      {c.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-flux-text1">{c.nombre}</p>
                      <p className="text-2xs text-flux-text3">{c.email}{c.cargo ? ` · ${c.cargo}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => removeContacto(i)} className="text-flux-text3 hover:text-flux-danger transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Añadir contacto */}
            <div className="bg-flux-surface border border-flux-border rounded-xl p-3 space-y-2">
              <p className="text-2xs text-flux-text3 mb-2">Añadir contacto</p>
              <div className="grid grid-cols-2 gap-2">
                <input className="flux-input text-xs" placeholder="Nombre *" value={nuevoContacto.nombre} onChange={e => setNuevoContacto(p => ({ ...p, nombre: e.target.value }))} />
                <input className="flux-input text-xs" placeholder="Email *" value={nuevoContacto.email} onChange={e => setNuevoContacto(p => ({ ...p, email: e.target.value }))} />
                <input className="flux-input text-xs" placeholder="Cargo" value={nuevoContacto.cargo} onChange={e => setNuevoContacto(p => ({ ...p, cargo: e.target.value }))} />
                <input className="flux-input text-xs" placeholder="Teléfono" value={nuevoContacto.telefono} onChange={e => setNuevoContacto(p => ({ ...p, telefono: e.target.value }))} />
              </div>
              <button type="button" onClick={addContacto} className="btn-ghost text-xs flex items-center gap-1.5 mt-1">
                <Plus size={12} /> Añadir contacto
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function ClientesPage() {
  const { data: clientes, loading: lc } = useCollection<Cliente>('clientes')
  const { data: opors,    loading: lo } = useCollection<Oportunidad>('oportunidades')

  const [modal,  setModal]  = useState<'new' | Cliente | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterEst, setFilterEst] = useState<ClienteEstado | 'todos'>('todos')

  const filtered = clientes.filter(c => {
    const matchSearch = !search ||
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.empresa.toLowerCase().includes(search.toLowerCase())
    const matchEst = filterEst === 'todos' || c.estado === filterEst
    return matchSearch && matchEst
  })

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este cliente? Se perderán sus proyectos y abonos asociados.')) return
    await deleteDocById('clientes', id)
    setMenuId(null)
  }

  const loading = lc || lo

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Clientes"
          subtitle={`${clientes.filter(c => c.estado === 'activo').length} activos · ${clientes.length} en total`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nuevo cliente
            </button>
          }
        />

        <div className="px-8 pb-10 space-y-5">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3" />
              <input
                className="flux-input pl-9"
                placeholder="Buscar por nombre o empresa…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5">
              {(['todos', ...ESTADOS] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setFilterEst(e)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    filterEst === e ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1'
                  )}
                >
                  {e === 'todos' ? 'Todos' : e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center"><Spinner /> Cargando…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Building2 size={40} />}
              title="Sin clientes todavía"
              description="Los clientes se crean al ganar una oportunidad o manualmente."
              action={<button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2"><Plus size={14} /> Crear cliente</button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(cliente => (
                <div key={cliente.id} className="flux-card group relative">
                  <div className="flex items-start justify-between mb-3">
                    <Badge variant={ESTADO_BADGE[cliente.estado]}>{cliente.estado}</Badge>
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setMenuId(menuId === cliente.id ? null : cliente.id)}
                        className="text-flux-text3 hover:text-flux-text1 transition-colors opacity-0 group-hover:opacity-100 p-1 rounded"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {menuId === cliente.id && (
                        <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[130px]">
                          <button onClick={() => { setModal(cliente); setMenuId(null) }}
                            className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                            <Pencil size={11} /> Editar
                          </button>
                          <button onClick={() => handleDelete(cliente.id)}
                            className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-danger hover:bg-flux-muted">
                            <Trash2 size={11} /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <Link href={`/clientes/${cliente.id}`} className="block">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-flux-muted flex items-center justify-center text-sm font-bold text-flux-teal shrink-0">
                        {cliente.empresa.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-flux-text1 group-hover:text-flux-white transition-colors truncate">{cliente.empresa}</p>
                        <p className="text-2xs text-flux-text3 truncate">{cliente.nombre}</p>
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      <p className="text-2xs text-flux-text3 flex items-center gap-1.5">
                        <Mail size={10} /> {cliente.email}
                      </p>
                      {cliente.sector && (
                        <p className="text-2xs text-flux-text3">{cliente.sector}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-flux-border/50">
                      <span className="text-2xs text-flux-text3">
                        {cliente.contactos?.length ?? 0} contacto{(cliente.contactos?.length ?? 0) !== 1 ? 's' : ''}
                      </span>
                      <span className="text-2xs text-flux-teal opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                        Ver ficha <ExternalLink size={10} />
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modal !== null && (
        <ClienteModal
          cliente={modal === 'new' ? undefined : modal}
          opors={opors}
          onClose={() => setModal(null)}
        />
      )}
      {menuId && <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />}
    </>
  )
}
