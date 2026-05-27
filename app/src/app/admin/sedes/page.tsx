'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useSedes } from '@/hooks/useApi'

interface Consultorio {
  id: string
  nombre: string
  numero: string | null
  activo: boolean
}

interface Sede {
  id: string
  nombre: string
  direccion: string | null
  ciudad: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
  activa: boolean
  consultorios?: Consultorio[]
  _count?: { turnos: number }
}

export default function SedesPage() {
  const { data: sedes, isLoading } = useSedes()
  const qc = useQueryClient()
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', direccion: '', ciudad: '', provincia: '', telefono: '', email: '' })
  const [verConsultorios, setVerConsultorios] = useState<string | null>(null)

  const crear = useMutation({
    mutationFn: (body: any) => api.post('/sedes', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sedes'] }),
  })
  const actualizar = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/sedes/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sedes'] }),
  })

  function abrirNueva() {
    setEditando('nueva')
    setForm({ nombre: '', direccion: '', ciudad: '', provincia: '', telefono: '', email: '' })
  }
  function abrirEditar(s: Sede) {
    setEditando(s.id)
    setForm({ nombre: s.nombre, direccion: s.direccion ?? '', ciudad: s.ciudad ?? '', provincia: s.provincia ?? '', telefono: s.telefono ?? '', email: s.email ?? '' })
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const body = {
      ...form,
      direccion: form.direccion || null,
      ciudad: form.ciudad || null,
      provincia: form.provincia || null,
      telefono: form.telefono || null,
      email: form.email || null,
    }
    if (editando === 'nueva') await crear.mutateAsync(body)
    else if (editando) await actualizar.mutateAsync({ id: editando, body })
    setEditando(null)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Sedes</h1>
        <button onClick={abrirNueva} style={btnPrimary}>+ Nueva sede</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Lugares físicos donde se atiende a los pacientes</p>

      {editando && (
        <form onSubmit={guardar} style={{ background: 'var(--surface)', border: '1px solid var(--teal)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{editando === 'nueva' ? 'Nueva sede' : 'Editar sede'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
            <Field label="Nombre *"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required style={input} /></Field>
            <Field label="Teléfono"><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={input} /></Field>
          </div>
          <Field label="Dirección"><input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} style={input} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10 }}>
            <Field label="Ciudad"><input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} style={input} /></Field>
            <Field label="Provincia"><input value={form.provincia} onChange={(e) => setForm({ ...form, provincia: e.target.value })} style={input} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></Field>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" onClick={() => setEditando(null)} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={crear.isPending || actualizar.isPending} style={btnPrimary}>{editando === 'nueva' ? 'Crear' : 'Guardar'}</button>
          </div>
        </form>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (sedes ?? []).length === 0 ? <Empty texto="Sin sedes. Creá la primera." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Nombre</th>
                <th style={th}>Dirección</th>
                <th style={th}>Ciudad</th>
                <th style={th}>Teléfono</th>
                <th style={th}>Activa</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {(sedes ?? []).map((s: Sede) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><strong>{s.nombre}</strong></td>
                  <td style={td}>{s.direccion ?? '—'}</td>
                  <td style={td}>{s.ciudad ?? '—'}{s.provincia && `, ${s.provincia}`}</td>
                  <td style={td}>{s.telefono ?? '—'}</td>
                  <td style={td}>{s.activa ? <span style={{ color: 'var(--salud)' }}>✓</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={td}>
                    <button onClick={() => abrirEditar(s)} style={iconBtn}>Editar</button>
                    <button onClick={() => setVerConsultorios(verConsultorios === s.id ? null : s.id)} style={{ ...iconBtn, marginLeft: 10 }}>
                      {verConsultorios === s.id ? 'Cerrar' : 'Consultorios →'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {verConsultorios && <ConsultoriosBlock sedeId={verConsultorios} />}
    </div>
  )
}

function ConsultoriosBlock({ sedeId }: { sedeId: string }) {
  const qc = useQueryClient()
  const { data: sede } = useQuery({
    queryKey: ['sede', sedeId],
    queryFn: () => api.get<Sede>(`/sedes/${sedeId}`),
  })
  const crear = useMutation({
    mutationFn: (body: any) => api.post('/sedes/consultorios', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sede', sedeId] })
      qc.invalidateQueries({ queryKey: ['sedes'] })
    },
  })
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    await crear.mutateAsync({ sede_id: sedeId, nombre, numero: numero || null })
    setNombre(''); setNumero('')
  }

  return (
    <div style={{ marginTop: 16, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
        Consultorios de {sede?.nombre}
      </h3>
      <form onSubmit={agregar} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 100px', gap: 8, marginBottom: 12 }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Consultorio 1)" required style={input} />
        <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="N° (ej. 101)" style={input} />
        <button type="submit" disabled={crear.isPending} style={btnPrimary}>+ Agregar</button>
      </form>
      {(sede?.consultorios ?? []).length === 0 ? (
        <div style={{ color: 'var(--muted)', fontSize: 13, padding: 12 }}>Sin consultorios.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {sede!.consultorios!.map((c) => (
            <div key={c.id} style={{ padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{c.nombre}</div>
              {c.numero && <div style={{ fontSize: 11, color: 'var(--muted)' }}>N° {c.numero}</div>}
            </div>
          ))}
        </div>
      )}
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
