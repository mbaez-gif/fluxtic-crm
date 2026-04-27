'use client'

import { useState }         from 'react'
import { useCollection }    from '@/lib/hooks/useCollection'
import { db }               from '@/lib/firebase/config'
import {
  doc, deleteDoc, addDoc,
  collection, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { PageHeader }       from '@/components/layout/PageHeader'
import { EmptyState, Spinner } from '@/components/ui'
import { Store, Plus, Trash2, Pencil, X, Save } from 'lucide-react'

interface Proveedor {
  id:     string
  nombre: string
  taxId:  string
  email:  string
  rubro:  string
  activo: boolean
}

function ProveedorModal({ prov, onClose }: {
  prov?: Proveedor; onClose: () => void
}) {
  const [form,   setForm]   = useState({
    nombre: prov?.nombre ?? '',
    taxId:  prov?.taxId  ?? '',
    email:  prov?.email  ?? '',
    rubro:  prov?.rubro  ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const data = {
        nombre: form.nombre.trim(),
        taxId:  form.taxId.trim()  || null,
        email:  form.email.trim()  || null,
        rubro:  form.rubro.trim()  || null,
        activo: true,
      }
      if (prov) {
        await updateDoc(doc(db, 'adminProveedores', prov.id), {
          ...data, actualizadoEn: serverTimestamp(),
        })
      } else {
        await addDoc(collection(db, 'adminProveedores'), {
          ...data, creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp(),
        })
      }
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-flux-card border border-flux-border rounded-2xl p-6 space-y-4 shadow-card-hover">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-flux-white">{prov ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
          <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 p-1"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Nombre *</label>
            <input className="flux-input" value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">CUIT / Tax ID</label>
            <input className="flux-input" placeholder="20-12345678-9" value={form.taxId}
              onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Email</label>
            <input type="email" className="flux-input" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-flux-text2 mb-1.5">Rubro</label>
            <input className="flux-input" placeholder="Software, Servicios, etc." value={form.rubro}
              onChange={e => setForm(f => ({ ...f, rubro: e.target.value }))} />
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

export default function ProveedoresPage() {
  const { data: proveedores, loading } = useCollection<Proveedor>('adminProveedores')
  const [modal,    setModal]    = useState<'new' | Proveedor | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar el proveedor "${nombre}"? Los gastos asociados no se borrarán.`)) return
    setDeleting(id)
    try {
      await deleteDoc(doc(db, 'adminProveedores', id))
    } finally { setDeleting(null) }
  }

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Proveedores"
          subtitle={`${proveedores.length} proveedores`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14} /> Nuevo proveedor
            </button>
          }
        />

        <div className="px-4 md:px-8 pb-10 pt-4">
          {loading ? (
            <div className="flex justify-center py-20"><Spinner size={24} /></div>
          ) : proveedores.length === 0 ? (
            <EmptyState icon={<Store size={40} />} title="Sin proveedores"
              description="Registrá tus proveedores para agilizar la carga de gastos."
              action={
                <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
                  <Plus size={14} /> Nuevo proveedor
                </button>
              } />
          ) : (
            <div className="flux-card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-flux-border">
                    {['Nombre', 'CUIT', 'Email', 'Rubro', ''].map(h => (
                      <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map(p => (
                    <tr key={p.id} className="border-b border-flux-border/50 hover:bg-flux-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-flux-text1">{p.nombre}</td>
                      <td className="px-4 py-3 text-xs text-flux-text3 font-mono">{p.taxId || '—'}</td>
                      <td className="px-4 py-3 text-xs text-flux-text2">{p.email || '—'}</td>
                      <td className="px-4 py-3 text-xs text-flux-text3">{p.rubro || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setModal(p)}
                            className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-text1 hover:bg-flux-muted transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(p.id, p.nombre)}
                            disabled={deleting === p.id}
                            className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-danger hover:bg-red-950/30 transition-colors">
                            {deleting === p.id ? <Spinner size={13} /> : <Trash2 size={13} />}
                          </button>
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
        <ProveedorModal
          prov={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
