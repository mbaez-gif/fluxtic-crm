'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCoberturas } from '@/hooks/useApi'

export default function CoberturasPage() {
  const { data: coberturas, isLoading } = useCoberturas()
  const qc = useQueryClient()

  const crearCobertura = useMutation({
    mutationFn: (body: any) => api.post('/coberturas', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coberturas'] }),
  })
  const actualizarCobertura = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/coberturas/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coberturas'] }),
  })
  const crearPlan = useMutation({
    mutationFn: (body: any) => api.post('/coberturas/planes', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['coberturas'] }),
  })

  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', tipo: 'OBRA_SOCIAL', codigo: '', cuit: '', telefono: '', email: '' })
  const [verPlanes, setVerPlanes] = useState<string | null>(null)
  const [nuevoPlan, setNuevoPlan] = useState({ nombre: '', codigo: '', porcentaje: 80 })

  function abrirNueva() {
    setEditando('nueva')
    setForm({ nombre: '', tipo: 'OBRA_SOCIAL', codigo: '', cuit: '', telefono: '', email: '' })
  }
  function abrirEditar(c: any) {
    setEditando(c.id)
    setForm({ nombre: c.nombre, tipo: c.tipo, codigo: c.codigo ?? '', cuit: c.cuit ?? '', telefono: c.telefono ?? '', email: c.email ?? '' })
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const body = {
      ...form,
      codigo: form.codigo || null, cuit: form.cuit || null,
      telefono: form.telefono || null, email: form.email || null,
    }
    if (editando === 'nueva') await crearCobertura.mutateAsync(body)
    else if (editando) await actualizarCobertura.mutateAsync({ id: editando, body })
    setEditando(null)
  }

  async function agregarPlan(coberturaId: string, e: React.FormEvent) {
    e.preventDefault()
    await crearPlan.mutateAsync({
      cobertura_id: coberturaId,
      nombre: nuevoPlan.nombre,
      codigo: nuevoPlan.codigo || null,
      porcentaje_cobertura: nuevoPlan.porcentaje,
    })
    setNuevoPlan({ nombre: '', codigo: '', porcentaje: 80 })
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Coberturas y obras sociales</h1>
        <button onClick={abrirNueva} style={btnPrimary}>+ Nueva cobertura</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Obras sociales, prepagas y convenios con planes asociados</p>

      {editando && (
        <form onSubmit={guardar} style={{ background: 'var(--surface)', border: '1px solid var(--teal)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editando === 'nueva' ? 'Nueva cobertura' : 'Editar cobertura'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Nombre *"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required style={input} /></Field>
            <Field label="Tipo">
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={input}>
                <option value="OBRA_SOCIAL">Obra social</option>
                <option value="PREPAGA">Prepaga</option>
                <option value="PARTICULAR">Particular</option>
              </select>
            </Field>
            <Field label="Código (interno)"><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} style={input} /></Field>
            <Field label="CUIT"><input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} style={input} /></Field>
            <Field label="Teléfono"><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={input} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => setEditando(null)} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={crearCobertura.isPending || actualizarCobertura.isPending} style={btnPrimary}>
              {editando === 'nueva' ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (coberturas ?? []).length === 0 ? <Empty texto="Sin coberturas registradas." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Nombre</th>
                <th style={th}>Tipo</th>
                <th style={th}>Código</th>
                <th style={th}>CUIT</th>
                <th style={th}>Planes</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {(coberturas ?? []).map((c: any) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><strong>{c.nombre}</strong></td>
                  <td style={td}><span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.tipo}</span></td>
                  <td style={td}>{c.codigo ?? '—'}</td>
                  <td style={td}>{c.cuit ?? '—'}</td>
                  <td style={td}>{c.planes?.length ?? 0}</td>
                  <td style={td}>
                    <button onClick={() => abrirEditar(c)} style={iconBtn}>Editar</button>
                    <button onClick={() => setVerPlanes(verPlanes === c.id ? null : c.id)} style={{ ...iconBtn, marginLeft: 10 }}>
                      {verPlanes === c.id ? 'Cerrar' : 'Planes →'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {verPlanes && (() => {
        const c = coberturas?.find((x: any) => x.id === verPlanes)
        if (!c) return null
        return (
          <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Planes de {c.nombre}
            </h3>
            <form onSubmit={(e) => agregarPlan(c.id, e)} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px 100px', gap: 8, marginBottom: 12 }}>
              <input value={nuevoPlan.nombre} onChange={(e) => setNuevoPlan({ ...nuevoPlan, nombre: e.target.value })} placeholder="Nombre del plan (ej. Plan 210)" required style={input} />
              <input value={nuevoPlan.codigo} onChange={(e) => setNuevoPlan({ ...nuevoPlan, codigo: e.target.value })} placeholder="Código" style={input} />
              <input type="number" min={0} max={100} value={nuevoPlan.porcentaje} onChange={(e) => setNuevoPlan({ ...nuevoPlan, porcentaje: Number(e.target.value) })} placeholder="% cobertura" style={input} />
              <button type="submit" disabled={crearPlan.isPending} style={btnPrimary}>+ Plan</button>
            </form>
            {(c.planes ?? []).length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13, padding: 12 }}>Sin planes.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {c.planes.map((p: any) => (
                  <div key={p.id} style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Cobertura: {p.porcentaje_cobertura ? `${Number(p.porcentaje_cobertura)}%` : '—'}
                      {p.codigo && ` · ${p.codigo}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
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
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--teal)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }
