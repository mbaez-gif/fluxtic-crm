'use client'

import { useState } from 'react'
import { useMedicamentos, useCrearMedicamento } from '@/hooks/useApi'

export default function MedicamentosPage() {
  const [q, setQ] = useState('')
  const { data: medicamentos, isLoading, error } = useMedicamentos(q)
  const crear = useCrearMedicamento()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    codigo_externo: '',
    nombre_comercial: '',
    principio_activo: '',
    laboratorio: '',
    presentacion: '',
    via_admin: 'Oral',
    prescripcion_requerida: true,
    contraindicaciones: '',
  })

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    await crear.mutateAsync({
      ...form,
      codigo_externo: form.codigo_externo || null,
      laboratorio: form.laboratorio || null,
      presentacion: form.presentacion || null,
      via_admin: form.via_admin || null,
      contraindicaciones: form.contraindicaciones || null,
    })
    setOpen(false)
    setForm({ codigo_externo: '', nombre_comercial: '', principio_activo: '', laboratorio: '', presentacion: '', via_admin: 'Oral', prescripcion_requerida: true, contraindicaciones: '' })
  }

  const list = medicamentos ?? []

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Medicamentos / Vademécum</h1>
        <button onClick={() => setOpen(true)} style={btnPrimary}>+ Nuevo medicamento</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Vademécum local — base para recetas electrónicas y chequeo de interacciones · {list.length} cargados
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre comercial o principio activo (mínimo 2 caracteres)..."
        style={{ ...input, marginBottom: 16, padding: '10px 14px' }}
      />

      {open && (
        <form onSubmit={guardar} style={{ background: 'var(--surface)', border: '1px solid var(--teal)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Nuevo medicamento</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Nombre comercial *"><input value={form.nombre_comercial} onChange={(e) => setForm({ ...form, nombre_comercial: e.target.value })} required style={input} /></Field>
            <Field label="Principio activo *"><input value={form.principio_activo} onChange={(e) => setForm({ ...form, principio_activo: e.target.value })} required style={input} /></Field>
            <Field label="Código externo"><input value={form.codigo_externo} onChange={(e) => setForm({ ...form, codigo_externo: e.target.value })} placeholder="Ej. Kairos ID" style={input} /></Field>
            <Field label="Laboratorio"><input value={form.laboratorio} onChange={(e) => setForm({ ...form, laboratorio: e.target.value })} style={input} /></Field>
            <Field label="Presentación"><input value={form.presentacion} onChange={(e) => setForm({ ...form, presentacion: e.target.value })} placeholder="Ej. 20 mg comprimidos" style={input} /></Field>
            <Field label="Vía de administración"><input value={form.via_admin} onChange={(e) => setForm({ ...form, via_admin: e.target.value })} style={input} /></Field>
          </div>
          <Field label="Contraindicaciones (opcional)">
            <textarea value={form.contraindicaciones} onChange={(e) => setForm({ ...form, contraindicaciones: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} />
          </Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, marginBottom: 12 }}>
            <input type="checkbox" checked={form.prescripcion_requerida} onChange={(e) => setForm({ ...form, prescripcion_requerida: e.target.checked })} />
            Requiere prescripción médica
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setOpen(false)} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={crear.isPending} style={btnPrimary}>{crear.isPending ? 'Guardando...' : 'Crear'}</button>
          </div>
        </form>
      )}

      {error && <div style={{ padding: 12, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{(error as any)?.message ?? 'Error'}</div>}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : list.length === 0 ? <Empty texto={q.length >= 2 ? `Sin resultados para "${q}"` : 'Sin medicamentos cargados. Cargá el primero arriba.'} /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Nombre comercial</th>
                <th style={th}>Principio activo</th>
                <th style={th}>Presentación</th>
                <th style={th}>Laboratorio</th>
                <th style={th}>Vía</th>
                <th style={th}>Prescripción</th>
              </tr>
            </thead>
            <tbody>
              {list.map((m: any) => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><strong>{m.nombre_comercial}</strong></td>
                  <td style={td}>{m.principio_activo}</td>
                  <td style={td}>{m.presentacion ?? '—'}</td>
                  <td style={td}>{m.laboratorio ?? '—'}</td>
                  <td style={td}>{m.via_admin ?? '—'}</td>
                  <td style={td}>
                    {m.prescripcion_requerida ? (
                      <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: 'var(--warning-l)', color: 'var(--warning)' }}>Receta</span>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: 11 }}>Venta libre</span>
                    )}
                  </td>
                </tr>
              ))}
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
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
