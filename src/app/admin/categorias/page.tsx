'use client'

import { useState }       from 'react'
import { useCollection }  from '@/lib/hooks/useCollection'
import { db }             from '@/lib/firebase/config'
import {
  doc, deleteDoc, addDoc,
  collection, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { PageHeader }     from '@/components/layout/PageHeader'
import { EmptyState, Spinner } from '@/components/ui'
import { Tag, Plus, Trash2, Pencil, Check, X } from 'lucide-react'

interface Categoria { id: string; nombre: string; activa: boolean }

export default function CategoriasPage() {
  const { data: categorias, loading } = useCollection<Categoria>('adminCategorias')
  const [adding,   setAdding]   = useState(false)
  const [newName,  setNewName]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'adminCategorias'), {
        nombre: newName.trim(), activa: true, creadoEn: serverTimestamp(),
      })
      setNewName(''); setAdding(false)
    } finally { setSaving(false) }
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return
    await updateDoc(doc(db, 'adminCategorias', id), { nombre: editName.trim() })
    setEditId(null)
  }

  async function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return
    setDeleting(id)
    try { await deleteDoc(doc(db, 'adminCategorias', id)) }
    finally { setDeleting(null) }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Categorías"
        subtitle={`${categorias.length} categorías`}
        actions={
          <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Nueva categoría
          </button>
        }
      />

      <div className="px-4 md:px-8 pb-10 pt-4 max-w-xl">

        {adding && (
          <div className="flux-card flex items-center gap-3 mb-4">
            <input autoFocus className="flux-input flex-1" placeholder="Nombre de la categoría…"
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }} />
            <button onClick={handleAdd} disabled={saving}
              className="btn-primary p-2.5">
              {saving ? <Spinner size={14} /> : <Check size={14} />}
            </button>
            <button onClick={() => setAdding(false)} className="btn-ghost p-2.5">
              <X size={14} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : categorias.length === 0 ? (
          <EmptyState icon={<Tag size={40} />} title="Sin categorías"
            description="Las categorías te ayudan a clasificar los gastos."
            action={
              <button onClick={() => setAdding(true)} className="btn-primary flex items-center gap-2">
                <Plus size={14} /> Nueva categoría
              </button>
            } />
        ) : (
          <div className="flux-card p-0 overflow-hidden">
            {categorias.map(cat => (
              <div key={cat.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-flux-border/50 last:border-0 hover:bg-flux-muted/20 transition-colors">
                <Tag size={14} className="text-flux-text3 shrink-0" />
                {editId === cat.id ? (
                  <input autoFocus className="flux-input flex-1 py-1 text-sm"
                    value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleEdit(cat.id); if (e.key === 'Escape') setEditId(null) }} />
                ) : (
                  <span className="flex-1 text-sm text-flux-text1">{cat.nombre}</span>
                )}
                <div className="flex gap-1">
                  {editId === cat.id ? (
                    <>
                      <button onClick={() => handleEdit(cat.id)}
                        className="p-1.5 rounded-lg text-flux-teal hover:bg-flux-tealGlow/20 transition-colors">
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditId(null)}
                        className="p-1.5 rounded-lg text-flux-text3 hover:bg-flux-muted transition-colors">
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditId(cat.id); setEditName(cat.nombre) }}
                        className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-text1 hover:bg-flux-muted transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(cat.id, cat.nombre)}
                        disabled={deleting === cat.id}
                        className="p-1.5 rounded-lg text-flux-text3 hover:text-flux-danger hover:bg-red-950/30 transition-colors">
                        {deleting === cat.id ? <Spinner size={13} /> : <Trash2 size={13} />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
