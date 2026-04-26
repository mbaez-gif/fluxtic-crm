'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthContext }  from '@/components/auth/AuthProvider'
import { PageHeader }      from '@/components/layout/PageHeader'
import { Spinner }         from '@/components/ui'
import { db }              from '@/lib/firebase/config'
import {
  collection, getDocs, addDoc, updateDoc, doc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore'
import { normalizeStr, seedCategorias } from '@/lib/firebase/admin'
import type {
  Proveedor, Categoria, MedioPago,
  ProveedorTipo, MedioPagoTipo, Moneda,
} from '@/types/admin'
import { CATEGORIAS_INICIALES, MEDIO_PAGO_TIPO_LABEL, SOCIOS } from '@/types/admin'
import { cn } from '@/lib/utils'
import { Plus, Pencil, X, Check } from 'lucide-react'

// ── Proveedores ───────────────────────────────────────────
export function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading,     setLoading]     = useState(true)
  const [modal,       setModal]       = useState<'new' | Proveedor | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [form, setForm] = useState({
    nombre: '', tipo: 'software' as ProveedorTipo,
    taxId: '', website: '', contactEmail: '',
    monedaPorDefecto: 'ARS' as Moneda, notas: '',
  })

  const loadProveedores = useCallback(async () => {
    const snap = await getDocs(collection(db, 'adminProveedores'))
    setProveedores(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Proveedor))
    setLoading(false)
  }, [])

  useEffect(() => { loadProveedores() }, [loadProveedores])

  async function handleSave() {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const now = Timestamp.now()
      const base = {
        ...form,
        nombreNormalizado: normalizeStr(form.nombre),
        activo: true,
      }
      if (modal === 'new') {
        await addDoc(collection(db, 'adminProveedores'), {
          ...base,
          creadoEn:      serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        })
      } else if (modal) {
        await updateDoc(doc(db, 'adminProveedores', modal.id), {
          ...base,
          actualizadoEn: serverTimestamp(),
        })
      }
      // Reload from Firestore to avoid FieldValue type conflicts
      await loadProveedores()
      setModal(null)
      setForm({ nombre: '', tipo: 'software', taxId: '', website: '', contactEmail: '', monedaPorDefecto: 'ARS', notas: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Proveedores"
        subtitle={`${proveedores.length} proveedores`}
        actions={
          <button
            onClick={() => {
              setForm({ nombre: '', tipo: 'software', taxId: '', website: '', contactEmail: '', monedaPorDefecto: 'ARS', notas: '' })
              setModal('new')
            }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={14} /> Nuevo proveedor
          </button>
        }
      />
      <div className="px-8 pb-10">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <div className="flux-card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-flux-border">
                  {['Nombre', 'Tipo', 'CUIT', 'Email', 'Moneda', ''].map(h => (
                    <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {proveedores.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-flux-text3 text-sm">Sin proveedores todavía</td></tr>
                )}
                {proveedores.map(p => (
                  <tr key={p.id} className="border-b border-flux-border/50 hover:bg-flux-muted/20">
                    <td className="px-4 py-3 font-medium text-flux-text1">{p.nombre}</td>
                    <td className="px-4 py-3 text-xs text-flux-text2 capitalize">{p.tipo}</td>
                    <td className="px-4 py-3 text-xs text-flux-text3">{p.taxId || '—'}</td>
                    <td className="px-4 py-3 text-xs text-flux-text3">{p.contactEmail || '—'}</td>
                    <td className="px-4 py-3 text-xs text-flux-text2">{p.monedaPorDefecto || 'ARS'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setForm({
                            nombre: p.nombre, tipo: p.tipo,
                            taxId: p.taxId ?? '', website: p.website ?? '',
                            contactEmail: p.contactEmail ?? '',
                            monedaPorDefecto: p.monedaPorDefecto ?? 'ARS',
                            notas: p.notas ?? '',
                          })
                          setModal(p)
                        }}
                        className="text-flux-text2 hover:text-flux-white p-1"
                      >
                        <Pencil size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative w-full max-w-md bg-flux-card border border-flux-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-flux-white">
                {modal === 'new' ? 'Nuevo proveedor' : 'Editar proveedor'}
              </h2>
              <button onClick={() => setModal(null)}><X size={16} className="text-flux-text3" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1">Nombre *</label>
                <input className="flux-input" value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1">Tipo</label>
                  <select className="flux-input" value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as ProveedorTipo }))}>
                    {['software','service','supplier','freelancer','government','bank','other'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1">Moneda por defecto</label>
                  <select className="flux-input" value={form.monedaPorDefecto}
                    onChange={e => setForm(f => ({ ...f, monedaPorDefecto: e.target.value as Moneda }))}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1">CUIT</label>
                <input className="flux-input" placeholder="20-12345678-9"
                  value={form.taxId} onChange={e => setForm(f => ({ ...f, taxId: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1">Email de contacto</label>
                <input className="flux-input" value={form.contactEmail}
                  onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1">Notas</label>
                <textarea rows={2} className="flux-input resize-none"
                  value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="btn-primary flex items-center gap-2">
                {saving ? <Spinner size={14} /> : <Check size={14} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Categorías ────────────────────────────────────────────
export function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading,    setLoading]    = useState(true)
  const [seeding,    setSeeding]    = useState(false)

  useEffect(() => {
    getDocs(collection(db, 'adminCategorias')).then(snap => {
      setCategorias(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Categoria)
          .sort((a, b) => a.sortOrder - b.sortOrder)
      )
      setLoading(false)
    })
  }, [])

  async function handleSeed() {
    setSeeding(true)
    await seedCategorias(CATEGORIAS_INICIALES)
    const snap = await getDocs(collection(db, 'adminCategorias'))
    setCategorias(
      snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as Categoria)
        .sort((a, b) => a.sortOrder - b.sortOrder)
    )
    setSeeding(false)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Categorías"
        subtitle={`${categorias.length} categorías`}
        actions={categorias.length === 0 ? (
          <button onClick={handleSeed} disabled={seeding}
            className="btn-primary text-sm flex items-center gap-2">
            {seeding ? <Spinner size={14} /> : <Plus size={14} />} Cargar categorías iniciales
          </button>
        ) : undefined}
      />
      <div className="px-8 pb-10">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {categorias.map(c => (
              <div key={c.id} className="flux-card flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: c.color ?? '#00D4A8' }} />
                <p className="text-sm text-flux-text1 font-medium">{c.nombre}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Medios de pago ────────────────────────────────────────
export function MediosPagoPage() {
  const [medios,  setMedios]  = useState<MedioPago[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<'new' | MedioPago | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({
    nombre: '', tipo: 'bank_transfer' as MedioPagoTipo,
    ownerUid: '', ownerNombre: '',
    institucion: '', ultimos4: '',
    moneda: 'ARS' as Moneda, notas: '',
  })

  const loadMedios = useCallback(async () => {
    const snap = await getDocs(collection(db, 'adminMediosPago'))
    setMedios(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MedioPago))
    setLoading(false)
  }, [])

  useEffect(() => { loadMedios() }, [loadMedios])

  function setOwner(uid: string) {
    const socio = SOCIOS.find(s => s.uid === uid)
    setForm(f => ({ ...f, ownerUid: uid, ownerNombre: socio?.nombre ?? '' }))
  }

  async function handleSave() {
    if (!form.nombre.trim() || !form.ownerUid) return
    setSaving(true)
    try {
      const base = { ...form, activo: true }
      if (modal === 'new') {
        await addDoc(collection(db, 'adminMediosPago'), {
          ...base,
          creadoEn:      serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        })
      } else if (modal) {
        await updateDoc(doc(db, 'adminMediosPago', modal.id), {
          ...base,
          actualizadoEn: serverTimestamp(),
        })
      }
      await loadMedios()
      setModal(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Medios de pago"
        subtitle={`${medios.length} medios configurados`}
        actions={
          <button
            onClick={() => {
              setForm({ nombre: '', tipo: 'bank_transfer', ownerUid: '', ownerNombre: '', institucion: '', ultimos4: '', moneda: 'ARS', notas: '' })
              setModal('new')
            }}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Plus size={14} /> Nuevo medio
          </button>
        }
      />
      <div className="px-8 pb-10">
        {loading ? (
          <div className="flex justify-center py-20"><Spinner /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {medios.length === 0 && (
              <p className="text-flux-text3 text-sm col-span-3 py-10 text-center">
                Sin medios de pago configurados
              </p>
            )}
            {medios.map(m => {
              const socio = SOCIOS.find(s => s.uid === m.ownerUid)
              return (
                <div key={m.id} className="flux-card">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-medium text-flux-text1">{m.nombre}</p>
                      <p className="text-2xs text-flux-text3">{MEDIO_PAGO_TIPO_LABEL[m.tipo]}</p>
                    </div>
                    <button
                      onClick={() => {
                        setForm({
                          nombre: m.nombre, tipo: m.tipo,
                          ownerUid: m.ownerUid, ownerNombre: m.ownerNombre,
                          institucion: m.institucion ?? '',
                          ultimos4: m.ultimos4 ?? '',
                          moneda: m.moneda, notas: m.notas ?? '',
                        })
                        setModal(m)
                      }}
                      className="text-flux-text2 hover:text-flux-white p-1"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-flux-bg"
                      style={{ backgroundColor: socio?.color ?? '#9CA3AF' }}
                    >
                      {m.ownerNombre.charAt(0)}
                    </div>
                    <span className="text-xs text-flux-text2">{m.ownerNombre}</span>
                    {m.ultimos4 && (
                      <span className="text-2xs text-flux-text3 ml-auto">····{m.ultimos4}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative w-full max-w-md bg-flux-card border border-flux-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-flux-white">
                {modal === 'new' ? 'Nuevo medio de pago' : 'Editar medio de pago'}
              </h2>
              <button onClick={() => setModal(null)}><X size={16} className="text-flux-text3" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1">Nombre *</label>
                <input className="flux-input" placeholder="Ej: Débito Santander Martín"
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1">Titular *</label>
                <div className="flex gap-2">
                  {SOCIOS.map(s => (
                    <button key={s.uid} onClick={() => setOwner(s.uid)}
                      className={cn(
                        'flex-1 py-2 rounded-xl border text-xs font-medium transition-all',
                        form.ownerUid === s.uid
                          ? 'border-flux-teal bg-flux-tealGlow text-flux-teal'
                          : 'border-flux-border text-flux-text2 hover:border-flux-muted'
                      )}>
                      {s.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1">Tipo</label>
                  <select className="flux-input" value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as MedioPagoTipo }))}>
                    {Object.entries(MEDIO_PAGO_TIPO_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1">Moneda</label>
                  <select className="flux-input" value={form.moneda}
                    onChange={e => setForm(f => ({ ...f, moneda: e.target.value as Moneda }))}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1">Institución</label>
                  <input className="flux-input" placeholder="Banco / Billetera"
                    value={form.institucion}
                    onChange={e => setForm(f => ({ ...f, institucion: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1">Últimos 4 dígitos</label>
                  <input className="flux-input" maxLength={4} placeholder="1234"
                    value={form.ultimos4}
                    onChange={e => setForm(f => ({ ...f, ultimos4: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setModal(null)} className="btn-ghost">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="btn-primary flex items-center gap-2">
                {saving ? <Spinner size={14} /> : <Check size={14} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProveedoresPage
