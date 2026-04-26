'use client'

import { useState }          from 'react'
import { useAuthContext }    from '@/components/auth/AuthProvider'
import { useCollection }     from '@/lib/hooks/useCollection'
import { updateDocById, deleteDocById, createDoc } from '@/lib/firebase/firestore'
import { PageHeader }        from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { LeadDrawer }        from '@/components/leads/LeadDrawer'
import type { Lead }         from '@/types'
import { cn }                from '@/lib/utils'
import { format }            from 'date-fns'
import { es }                from 'date-fns/locale'
import type { Timestamp }    from 'firebase/firestore'
import {
  Plus, Search, X, Users, MoreHorizontal,
  Pencil, Trash2, Mail, MessageCircle, Eye,
} from 'lucide-react'

function toDate(ts: Timestamp | Date | string | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if ((ts as any).toDate) return (ts as any).toDate()
  return new Date()
}

const ESTADO_BADGE: Record<string, 'default' | 'teal' | 'info' | 'danger'> = {
  nuevo: 'default', contactado: 'info', calificado: 'teal', descartado: 'danger',
}
const ESTADO_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', calificado: 'Calificado', descartado: 'Descartado',
}

function LeadModal({ lead, onClose }: { lead?: Lead; onClose: () => void }) {
  const { profile } = useAuthContext()
  const [form, setForm] = useState({
    nombre:   lead?.nombre   ?? '',
    empresa:  lead?.empresa  ?? '',
    email:    lead?.email    ?? '',
    telefono: lead?.telefono ?? '',
    fuente:   lead?.fuente   ?? 'manual',
    estado:   lead?.estado   ?? 'nuevo',
    notas:    lead?.notas    ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.nombre || !form.empresa || !form.email) return
    setSaving(true)
    try {
      if (lead) {
        await updateDocById('leads', lead.id, form)
      } else {
        await createDoc('leads', { ...form, responsableId: profile?.uid ?? '' })
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-flux-card border border-flux-border rounded-2xl p-6 space-y-4 shadow-card-hover animate-slide-in">
        <h2 className="font-display font-bold text-flux-white">{lead ? 'Editar lead' : 'Nuevo lead'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-flux-text2 mb-1">Nombre *</label>
            <input className="flux-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-flux-text2 mb-1">Empresa *</label>
            <input className="flux-input" value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1">Email *</label>
            <input type="email" className="flux-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1">Teléfono</label>
            <input className="flux-input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1">Fuente</label>
            <select className="flux-input" value={form.fuente} onChange={e => setForm(f => ({ ...f, fuente: e.target.value }))}>
              {['manual','web','referido','redes','chat_bot','import'].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1">Estado</label>
            <select className="flux-input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as Lead['estado'] }))}>
              {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-flux-text2 mb-1">Notas</label>
            <textarea rows={3} className="flux-input resize-none text-sm" value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <Spinner size={14} />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LeadsPage() {
  // useCollection uses real-time Firestore snapshot — no refresh needed
  const { data: leads, loading } = useCollection<Lead>('leads')

  const [search,  setSearch]  = useState('')
  const [filtEst, setFiltEst] = useState('todos')
  const [modal,   setModal]   = useState<'new' | Lead | null>(null)
  const [drawer,  setDrawer]  = useState<Lead | null>(null)
  const [menuId,  setMenuId]  = useState<string | null>(null)

  const filtered = leads
    .filter(l => {
      const q = search.toLowerCase()
      const matchSearch = !search || [l.nombre, l.empresa, l.email].some(f => f?.toLowerCase().includes(q))
      const matchEst    = filtEst === 'todos' || l.estado === filtEst
      return matchSearch && matchEst
    })
    .sort((a, b) => toDate(b.creadoEn).getTime() - toDate(a.creadoEn).getTime())

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este lead?')) return
    await deleteDocById('leads', id)
    setMenuId(null)
  }

  function waUrl(lead: Lead) {
    if (!lead.telefono) return null
    const num = lead.telefono.replace(/\D/g, '')
    const msg = encodeURIComponent(`Hola ${lead.nombre.split(' ')[0]}, te contactamos desde Fluxtic.`)
    return `https://wa.me/${num}?text=${msg}`
  }

  // When drawer lead updates via real-time, keep it in sync
  const drawerLead = drawer ? leads.find(l => l.id === drawer.id) ?? drawer : null

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Leads"
          subtitle={`${filtered.length} de ${leads.length} leads`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nuevo lead
            </button>
          }
        />

        <div className="px-8 pb-10 space-y-5">
          {/* Filtros */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3" />
              <input className="flux-input pl-9 text-sm" placeholder="Buscar nombre, empresa o email…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-flux-text3 hover:text-flux-text1">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['todos', 'nuevo', 'contactado', 'calificado', 'descartado'] as const).map(e => (
                <button key={e} onClick={() => setFiltEst(e)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    filtEst === e ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                  {e === 'todos' ? 'Todos' : ESTADO_LABEL[e]}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Spinner size={24} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Users size={40} />} title="Sin leads"
              description="Los leads del formulario web aparecen acá automáticamente."
              action={
                <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
                  <Plus size={14} /> Nuevo lead
                </button>
              }
            />
          ) : (
            <div className="flux-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Nombre / Empresa', 'Contactar', 'Fuente', 'Estado', 'Creado', ''].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(lead => (
                    <tr key={lead.id} className="border-b border-flux-border/50 hover:bg-flux-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => setDrawer(lead)} className="text-left group">
                          <p className="font-medium text-flux-text1 group-hover:text-flux-teal transition-colors">
                            {lead.nombre}
                          </p>
                          <p className="text-2xs text-flux-text3">{lead.empresa}</p>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {lead.email && (
                            <a href={`https://mail.google.com/mail/?view=cm&to=${lead.email}&su=Fluxtic - Te contactamos`}
                              target="_blank" rel="noopener noreferrer" title={lead.email}
                              className="p-1.5 rounded-lg hover:bg-blue-950/40 text-flux-text3 hover:text-blue-400 transition-colors">
                              <Mail size={13} />
                            </a>
                          )}
                          {waUrl(lead) && (
                            <a href={waUrl(lead)!} target="_blank" rel="noopener noreferrer" title={lead.telefono}
                              className="p-1.5 rounded-lg hover:bg-green-950/40 text-flux-text3 hover:text-green-400 transition-colors">
                              <MessageCircle size={13} />
                            </a>
                          )}
                          {lead.email && (
                            <span className="text-2xs text-flux-text3 ml-1 hidden md:inline">{lead.email}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-flux-text3 capitalize">{lead.fuente}</td>
                      <td className="px-4 py-3">
                        <Badge variant={ESTADO_BADGE[lead.estado]}>
                          {ESTADO_LABEL[lead.estado] ?? lead.estado}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-2xs text-flux-text3 whitespace-nowrap">
                        {format(toDate(lead.creadoEn), "d MMM yy", { locale: es })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative flex items-center gap-0.5">
                          <button onClick={() => setDrawer(lead)} title="Ver ficha"
                            className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-teal hover:bg-flux-tealGlow/20 transition-colors">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => setMenuId(menuId === lead.id ? null : lead.id)}
                            className="p-1.5 rounded-lg text-flux-text2 hover:text-flux-white transition-colors">
                            <MoreHorizontal size={14} />
                          </button>
                          {menuId === lead.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                              <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[150px]">
                                <button onClick={() => { setDrawer(lead); setMenuId(null) }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                                  <Eye size={11} /> Ver ficha
                                </button>
                                <button onClick={() => { setModal(lead); setMenuId(null) }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                                  <Pencil size={11} /> Editar
                                </button>
                                <button onClick={() => handleDelete(lead.id)}
                                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-danger hover:bg-flux-muted">
                                  <Trash2 size={11} /> Eliminar
                                </button>
                              </div>
                            </>
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
        <LeadModal lead={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />
      )}

      {drawerLead && (
        <LeadDrawer
          lead={drawerLead}
          onClose={() => setDrawer(null)}
          onEdit={() => { setModal(drawerLead); setDrawer(null) }}
        />
      )}
    </>
  )
}
