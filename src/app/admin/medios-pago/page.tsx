'use client'

import { useState }       from 'react'
import { useCollection }  from '@/lib/hooks/useCollection'
import { db }             from '@/lib/firebase/config'
import {
  doc, deleteDoc, addDoc, collection,
  serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { PageHeader }     from '@/components/layout/PageHeader'
import { EmptyState, Spinner } from '@/components/ui'
import { DropdownMenu }   from '@/components/ui/DropdownMenu'
import { SOCIOS }         from '@/types/admin'
import { Wallet, Plus, Pencil, Trash2, Save, X } from 'lucide-react'

interface MedioPago {
  id:          string
  nombre:      string
  tipo:        string
  ownerUid:    string
  ownerNombre: string
  activo:      boolean
}

const TIPOS = [
  'Tarjeta crédito', 'Tarjeta débito', 'Transferencia',
  'Efectivo', 'Cuenta bancaria', 'Billetera virtual', 'Otro',
]

function MedioPagoModal({ medio, onClose }: { medio?: MedioPago; onClose: () => void }) {
  const socios = SOCIOS.filter(s => !s.uid.includes('_UID'))
  const [form,   setForm]   = useState({
    nombre:      medio?.nombre      ?? '',
    tipo:        medio?.tipo        ?? 'Transferencia',
    ownerUid:    medio?.ownerUid    ?? (socios[0]?.uid ?? ''),
    ownerNombre: medio?.ownerNombre ?? (socios[0]?.nombre ?? ''),
  })
  const [saving, setSaving] = useState(false)

  function selectOwner(uid: string) {
    const s = socios.find(s => s.uid === uid)
    setForm(f => ({ ...f, ownerUid: uid, ownerNombre: s?.nombre ?? '' }))
  }

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const data = {
        nombre: form.nombre.trim(), tipo: form.tipo,
        ownerUid: form.ownerUid, ownerNombre: form.ownerNombre, activo: true,
      }
      if (medio) {
        await updateDoc(doc(db, 'adminMediosPago', medio.id), { ...data, actualizadoEn: serverTimestamp() })
      } else {
        await addDoc(collection(db, 'adminMediosPago'), { ...data, creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() })
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-flux-card border border-flux-border rounded-2xl p-6 space-y-4 shadow-card-hover">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-flux-white">{medio ? 'Editar medio de pago' : 'Nuevo medio de pago'}</h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 p-1"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Nombre *</label>
            <input className="flux-input" placeholder="Ej: Visa Martín, Cuenta Santander…"
              value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Tipo</label>
            <select className="flux-input" value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Titular</label>
            <select className="flux-input" value={form.ownerUid} onChange={e => selectOwner(e.target.value)}>
              {socios.map(s => <option key={s.uid} value={s.uid}>{s.nombre}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="btn-ghost">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Spinner size={14} /> : <Save size={14} />} Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MediosPagoPage() {
  const { data: medios, loading } = useCollection<MedioPago>('adminMediosPago')
  const [modal,    setModal]    = useState<'new' | MedioPago | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el medio de pago "${nombre}"?`)) return
    setDeleting(id)
    try {
      await deleteDoc(doc(db, 'adminMediosPago', id))
    } catch (err: any) {
      alert('Error al eliminar: ' + (err?.message ?? 'Error'))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Medios de pago"
          subtitle={`${medios.length} medios registrados`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Nuevo medio
            </button>
          }
        />

        <div className="px-4 md:px-8 pb-10 pt-4 max-w-2xl">
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size={24} /></div>
          ) : medios.length === 0 ? (
            <EmptyState icon={<Wallet size={40} />} title="Sin medios de pago"
              description="Registrá las tarjetas y cuentas del equipo para los gastos."
              action={
                <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
                  <Plus size={14} /> Nuevo medio
                </button>
              } />
          ) : (
            <div className="flux-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Nombre', 'Tipo', 'Titular', ''].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {medios.map(m => (
                    <tr key={m.id} className="border-b border-flux-border/50 hover:bg-flux-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-flux-text1">{m.nombre}</td>
                      <td className="px-4 py-3 text-xs text-flux-text3">{m.tipo}</td>
                      <td className="px-4 py-3 text-xs text-flux-text2">{m.ownerNombre}</td>
                      <td className="px-4 py-3">
                        <DropdownMenu items={[
                          { label: 'Editar',   icon: <Pencil size={12} />, onClick: () => setModal(m) },
                          { label: 'Eliminar', icon: <Trash2 size={12} />, onClick: () => handleDelete(m.id, m.nombre), danger: true, disabled: deleting === m.id },
                        ]} />
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
        <MedioPagoModal medio={modal === 'new' ? undefined : modal} onClose={() => setModal(null)} />
      )}
    </>
  )
}
