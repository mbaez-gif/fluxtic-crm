'use client'

import { useState }          from 'react'
import { useAuthContext }    from '@/components/auth/AuthProvider'
import { useCollection }     from '@/lib/hooks/useCollection'
import { updateDocById, deleteDocById, createDoc } from '@/lib/firebase/firestore'
import { PageHeader }        from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import { LeadDrawer }        from '@/components/leads/LeadDrawer'
import { EmailComposer }     from '@/components/email/EmailComposer'
import type { Lead }         from '@/types'
import { cn }                from '@/lib/utils'
import { format }            from 'date-fns'
import { es }                from 'date-fns/locale'
import {
  Plus, Search, X, Users, Pencil,
  Trash2, Mail, MessageCircle, Eye, Phone,
} from 'lucide-react'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
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
      if (lead) await updateDocById('leads', lead.id, form)
      else await createDoc('leads', { ...form, responsableId: profile?.uid ?? '' })
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-flux-card border border-flux-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-card-hover max-h-[90vh] overflow-y-auto">
        <h2 className="font-display font-bold text-flux-white">{lead ? 'Editar lead' : 'Nuevo lead'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-flux-text2 mb-1">Nombre *</label>
            <input className="flux-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="sm:col-span-2">
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
            <select className="flux-input" value={form.estado}
              onChange={e => setForm(f => ({ ...f, estado: e.target.value as Lead['estado'] }))}>
              {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-flux-text2 mb-1">Notas</label>
            <textarea rows={3} className="flux-input resize-none text-sm" value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving && <Spinner size={14} />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Lead card for mobile ──────────────────────────────────
function LeadCard({ lead, onView, onEdit, onDelete, onEmail }: {
  lead: Lead
  onView:   () => void
  onEdit:   () => void
  onDelete: () => void
  onEmail:  () => void
}) {
  const waUrl = lead.telefono
    ? `https://wa.me/${lead.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${lead.nombre.split(' ')[0]}, te contactamos desde Fluxtic.`)}`
    : null

  return (
    <div className="flux-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <button onClick={onView} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <div className="w-9 h-9 rounded-full bg-flux-teal/20 flex items-center justify-center text-sm font-bold text-flux-teal shrink-0">
            {lead.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-flux-text1 text-sm truncate">{lead.nombre}</p>
            <p className="text-2xs text-flux-text3 truncate">{lead.empresa}</p>
          </div>
        </button>
        <Badge variant={ESTADO_BADGE[lead.estado]}>{ESTADO_LABEL[lead.estado]}</Badge>
      </div>

      {/* Contact buttons */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        {lead.email && (
          <button
            onClick={onEmail}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-blue-950/40 text-blue-400 border border-blue-800/30 hover:bg-blue-950/60 transition-colors"
          >
            <Mail size={11} /> Email
          </button>
        )}
        {waUrl && (
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-green-950/40 text-green-400 border border-green-800/30">
            <MessageCircle size={11} /> WhatsApp
          </a>
        )}
        {lead.telefono && (
          <a href={`tel:${lead.telefono}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-flux-muted text-flux-text2 border border-flux-border">
            <Phone size={11} /> Llamar
          </a>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-flux-border/50">
        <span className="text-2xs text-flux-text3 capitalize">
          {lead.fuente} · {format(toDate(lead.creadoEn), "d MMM yy", { locale: es })}
        </span>
        <div className="flex gap-1">
          <button onClick={onView}   className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-teal hover:bg-flux-tealGlow/20 transition-colors"><Eye size={14} /></button>
          <button onClick={onEdit}   className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-text1 hover:bg-flux-muted transition-colors"><Pencil size={14} /></button>
          <button onClick={onDelete} className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-danger hover:bg-red-950/30 transition-colors"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function LeadsPage() {
  const { data: leads, loading } = useCollection<Lead>('leads')
  const [search,       setSearch]       = useState('')
  const [filtEst,      setFiltEst]      = useState('todos')
  const [modal,        setModal]        = useState<'new' | Lead | null>(null)
  const [drawer,       setDrawer]       = useState<Lead | null>(null)
  // Track which lead to email — separate from drawer
  const [emailTarget,  setEmailTarget]  = useState<Lead | null>(null)

  const filtered = leads
    .filter(l => {
      const q = search.toLowerCase()
      return (!search || [l.nombre, l.empresa, l.email].some(f => f?.toLowerCase().includes(q)))
        && (filtEst === 'todos' || l.estado === filtEst)
    })
    .sort((a, b) => toDate(b.creadoEn).getTime() - toDate(a.creadoEn).getTime())

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este lead?')) return
    await deleteDocById('leads', id)
  }

  function waUrl(lead: Lead) {
    if (!lead.telefono) return null
    return `https://wa.me/${lead.telefono.replace(/\D/g,'')}?text=${encodeURIComponent(`Hola ${lead.nombre.split(' ')[0]}, te contactamos desde Fluxtic.`)}`
  }

  const drawerLead = drawer ? leads.find(l => l.id === drawer.id) ?? drawer : null

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Leads"
          subtitle={`${filtered.length} de ${leads.length} leads`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Nuevo lead
            </button>
          }
        />

        <div className="px-4 md:px-8 pb-10 space-y-4 pt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3" />
              <input className="flux-input pl-9 text-sm" placeholder="Buscar nombre, empresa o email…"
                value={search} onChange={e => setSearch(e.target.value)} />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-flux-text3">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(['todos','nuevo','contactado','calificado','descartado'] as const).map(e => (
                <button key={e} onClick={() => setFiltEst(e)}
                  className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                    filtEst === e ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3')}>
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
              action={<button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2"><Plus size={14} /> Nuevo lead</button>} />
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
                {filtered.map(lead => (
                  <LeadCard key={lead.id} lead={lead}
                    onView={()   => setDrawer(lead)}
                    onEdit={()   => setModal(lead)}
                    onDelete={()  => handleDelete(lead.id)}
                    onEmail={()  => setEmailTarget(lead)}
                  />
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block flux-card p-0 overflow-hidden">
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
                            <p className="font-medium text-flux-text1 group-hover:text-flux-teal transition-colors">{lead.nombre}</p>
                            <p className="text-2xs text-flux-text3">{lead.empresa}</p>
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* Email — opens CRM composer */}
                            {lead.email && (
                              <button
                                onClick={() => setEmailTarget(lead)}
                                title={`Enviar email a ${lead.email}`}
                                className="p-1.5 rounded-lg hover:bg-blue-950/40 text-flux-text3 hover:text-blue-400 transition-colors"
                              >
                                <Mail size={13} />
                              </button>
                            )}
                            {/* WhatsApp */}
                            {waUrl(lead) && (
                              <a href={waUrl(lead)!} target="_blank" rel="noopener noreferrer"
                                title={lead.telefono}
                                className="p-1.5 rounded-lg hover:bg-green-950/40 text-flux-text3 hover:text-green-400 transition-colors">
                                <MessageCircle size={13} />
                              </a>
                            )}
                            {lead.email && (
                              <span className="text-2xs text-flux-text3 ml-1 truncate max-w-[140px]">{lead.email}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-flux-text3 capitalize">{lead.fuente}</td>
                        <td className="px-4 py-3">
                          <Badge variant={ESTADO_BADGE[lead.estado]}>{ESTADO_LABEL[lead.estado]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-2xs text-flux-text3">
                          {format(toDate(lead.creadoEn), "d MMM yy", { locale: es })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => setDrawer(lead)}
                              className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-teal hover:bg-flux-tealGlow/20 transition-colors">
                              <Eye size={14} />
                            </button>
                            <button onClick={() => setModal(lead)}
                              className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-text1 hover:bg-flux-muted transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => handleDelete(lead.id)}
                              className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-danger hover:bg-red-950/30 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal !== null && (
        <LeadModal lead={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />
      )}

      {drawerLead && (
        <LeadDrawer lead={drawerLead} onClose={() => setDrawer(null)}
          onEdit={() => { setModal(drawerLead); setDrawer(null) }} />
      )}

      {/* Email composer — triggered from table OR card, independent of drawer */}
      {emailTarget?.email && (
        <EmailComposer
          nombre={emailTarget.nombre}
          email={emailTarget.email}
          leadId={emailTarget.id}
          onClose={() => setEmailTarget(null)}
        />
      )}
    </>
  )
}
