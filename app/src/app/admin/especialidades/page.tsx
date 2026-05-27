'use client'

import { useState } from 'react'
import { useEspecialidades, useCrearEspecialidad, useActualizarEspecialidad } from '@/hooks/useApi'

export default function EspecialidadesPage() {
  const { data: especialidades, isLoading } = useEspecialidades()
  const crear = useCrearEspecialidad()
  const actualizar = useActualizarEspecialidad()
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', codigo: '', descripcion: '' })

  function abrirNueva() {
    setEditando('nueva')
    setForm({ nombre: '', codigo: '', descripcion: '' })
  }
  function abrirEditar(e: any) {
    setEditando(e.id)
    setForm({ nombre: e.nombre, codigo: e.codigo ?? '', descripcion: e.descripcion ?? '' })
  }
  async function guardar(ev: React.FormEvent) {
    ev.preventDefault()
    const body = { ...form, codigo: form.codigo || null, descripcion: form.descripcion || null }
    if (editando === 'nueva') await crear.mutateAsync(body)
    else if (editando) await actualizar.mutateAsync({ id: editando, body })
    setEditando(null)
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Especialidades</h1>
        <button onClick={abrirNueva} style={btnPrimary}>+ Nueva especialidad</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>{especialidades?.length ?? 0} especialidades configuradas</p>

      {editando && (
        <form onSubmit={guardar} style={{ background: 'var(--surface)', border: '1px solid var(--teal)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editando === 'nueva' ? 'Nueva especialidad' : 'Editar especialidad'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
            <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre *" required style={input} />
            <input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} placeholder="Código (ej. CARD)" style={input} />
          </div>
          <input value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción (opcional)" style={input} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" onClick={() => setEditando(null)} style={btnSecondary}>Cancelar</button>
            <button type="submit" style={btnPrimary}>{editando === 'nueva' ? 'Crear' : 'Guardar'}</button>
          </div>
        </form>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (especialidades ?? []).length === 0 ? <Empty texto="Sin especialidades. Creá la primera." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Nombre</th>
                <th style={th}>Código</th>
                <th style={th}>Descripción</th>
                <th style={th}>Estado</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {especialidades?.map((e: any) => (
                <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><span style={{ fontWeight: 500 }}>{e.nombre}</span></td>
                  <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--muted)' }}>{e.codigo ?? '—'}</code></td>
                  <td style={td}>{e.descripcion ?? '—'}</td>
                  <td style={td}>{e.activa ? <span style={{ color: 'var(--salud)' }}>Activa</span> : <span style={{ color: 'var(--muted)' }}>Inactiva</span>}</td>
                  <td style={td}><button onClick={() => abrirEditar(e)} style={iconBtn}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)' }
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--teal)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }
