'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Insumo {
  id: string
  codigo: string | null
  nombre: string
  descripcion: string | null
  unidad: string
  stock_actual: number
  stock_minimo: number
  proveedor: string | null
  precio_unitario: string | null
  activo: boolean
  lotes?: Array<{ id: string; numero_lote: string; vencimiento: string | null; cantidad: number }>
}

export default function InsumosPage() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [bajoStock, setBajoStock] = useState(false)
  const { data: insumos, isLoading } = useQuery({
    queryKey: ['insumos', q, bajoStock],
    queryFn: () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (bajoStock) params.set('bajo_stock', 'true')
      return api.get<Insumo[]>(`/insumos?${params.toString()}`)
    },
  })

  const crear = useMutation({
    mutationFn: (body: any) => api.post('/insumos', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insumos'] }),
  })

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ codigo: '', nombre: '', unidad: 'unidad', stock_minimo: 0, proveedor: '', precio_unitario: 0 })

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    await crear.mutateAsync({
      codigo: form.codigo || null,
      nombre: form.nombre,
      unidad: form.unidad,
      stock_minimo: form.stock_minimo,
      proveedor: form.proveedor || null,
      precio_unitario: form.precio_unitario || null,
    })
    setOpen(false)
    setForm({ codigo: '', nombre: '', unidad: 'unidad', stock_minimo: 0, proveedor: '', precio_unitario: 0 })
  }

  const list = insumos ?? []
  const criticos = list.filter((i) => i.stock_actual <= i.stock_minimo)

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Insumos médicos</h1>
        <button onClick={() => setOpen(true)} style={btnPrimary}>+ Nuevo insumo</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Stock, lotes y vencimientos · {list.length} insumos · {criticos.length} con stock crítico</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o código..." style={{ ...input, flex: 1 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={bajoStock} onChange={(e) => setBajoStock(e.target.checked)} />
          Solo stock crítico
        </label>
      </div>

      {open && (
        <form onSubmit={guardar} style={{ background: 'var(--surface)', border: '1px solid var(--teal)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Nuevo insumo</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Código"><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} style={input} /></Field>
            <Field label="Nombre *"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required style={input} /></Field>
            <Field label="Unidad"><input value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} style={input} /></Field>
            <Field label="Stock mínimo"><input type="number" min={0} value={form.stock_minimo} onChange={(e) => setForm({ ...form, stock_minimo: Number(e.target.value) })} style={input} /></Field>
            <Field label="Precio unitario"><input type="number" min={0} step={0.01} value={form.precio_unitario} onChange={(e) => setForm({ ...form, precio_unitario: Number(e.target.value) })} style={input} /></Field>
            <Field label="Proveedor"><input value={form.proveedor} onChange={(e) => setForm({ ...form, proveedor: e.target.value })} style={input} /></Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setOpen(false)} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={crear.isPending} style={btnPrimary}>Crear</button>
          </div>
        </form>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : list.length === 0 ? <Empty texto={bajoStock ? 'Sin insumos con stock crítico 👌' : 'Sin insumos cargados.'} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Código</th>
                <th style={th}>Nombre</th>
                <th style={th}>Stock</th>
                <th style={th}>Mínimo</th>
                <th style={th}>Lotes</th>
                <th style={th}>Proveedor</th>
                <th style={th}>Precio</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const critico = i.stock_actual <= i.stock_minimo
                return (
                  <tr key={i.id} style={{ borderTop: '1px solid var(--border)', background: critico ? 'var(--warning-l)' : 'transparent' }}>
                    <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 11 }}>{i.codigo ?? '—'}</code></td>
                    <td style={td}><strong>{i.nombre}</strong></td>
                    <td style={td}>
                      <strong style={{ color: critico ? 'var(--danger)' : 'var(--noir)' }}>{i.stock_actual}</strong> {i.unidad}
                      {critico && <span style={{ marginLeft: 6, padding: '1px 6px', background: 'var(--danger-l)', color: 'var(--danger)', fontSize: 9, borderRadius: 3, fontWeight: 600 }}>CRÍTICO</span>}
                    </td>
                    <td style={td}>{i.stock_minimo}</td>
                    <td style={td}>{(i.lotes ?? []).length}</td>
                    <td style={td}>{i.proveedor ?? '—'}</td>
                    <td style={td}>{i.precio_unitario ? `$${Number(i.precio_unitario).toLocaleString('es-AR')}` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)' }
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
