'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProfesionales, useEspecialidades, useSedes, useCrearProfesional } from '@/hooks/useApi'

export default function ProfesionalesPage() {
  const [filtroEsp, setFiltroEsp] = useState('')
  const { data: profs, isLoading } = useProfesionales(filtroEsp || undefined)
  const especialidades = useEspecialidades()
  const sedes = useSedes()
  const crear = useCrearProfesional()
  const [showNuevo, setShowNuevo] = useState(false)
  const [form, setForm] = useState<any>({
    email: '', password: 'Salud2026!', nombre: '', apellido: '', telefono: '',
    rol: 'MEDICO', matricula: '', especialidad_id: '', subespecialidad: '',
    duracion_consulta_min: 30, porcentaje_liquidacion: 0,
    sedes: [] as string[],
  })

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const body: any = {
      ...form,
      telefono: form.telefono || null,
      subespecialidad: form.subespecialidad || null,
      duracion_consulta_min: Number(form.duracion_consulta_min),
      porcentaje_liquidacion: Number(form.porcentaje_liquidacion),
    }
    await crear.mutateAsync(body)
    setShowNuevo(false)
    setForm({ email: '', password: 'Salud2026!', nombre: '', apellido: '', telefono: '', rol: 'MEDICO', matricula: '', especialidad_id: '', subespecialidad: '', duracion_consulta_min: 30, porcentaje_liquidacion: 0, sedes: [] })
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Profesionales</h1>
        <button onClick={() => setShowNuevo(true)} style={btnPrimary}>+ Nuevo profesional</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Médicos y coordinadores · {profs?.length ?? 0} registrados</p>

      <div style={{ marginBottom: 16 }}>
        <select value={filtroEsp} onChange={(e) => setFiltroEsp(e.target.value)} style={{ ...input, maxWidth: 280 }}>
          <option value="">Todas las especialidades</option>
          {especialidades.data?.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>

      {showNuevo && (
        <form onSubmit={guardar} style={{ background: 'var(--surface)', border: '1px solid var(--teal)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Nuevo profesional</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <Field label="Nombre *"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required style={input} /></Field>
            <Field label="Apellido *"><input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required style={input} /></Field>
            <Field label="Email *"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required style={input} /></Field>
            <Field label="Password inicial *"><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} style={input} /></Field>
            <Field label="Teléfono"><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={input} /></Field>
            <Field label="Rol">
              <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} style={input}>
                <option value="MEDICO">Médico/a</option>
                <option value="COORDINADOR_MEDICO">Coordinador/a médico</option>
              </select>
            </Field>
            <Field label="Matrícula *"><input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} required placeholder="MN-12345" style={input} /></Field>
            <Field label="Especialidad *">
              <select value={form.especialidad_id} onChange={(e) => setForm({ ...form, especialidad_id: e.target.value })} required style={input}>
                <option value="">Seleccionar...</option>
                {especialidades.data?.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
            <Field label="Subespecialidad"><input value={form.subespecialidad} onChange={(e) => setForm({ ...form, subespecialidad: e.target.value })} style={input} /></Field>
            <Field label="Duración consulta (min)"><input type="number" min={5} step={5} value={form.duracion_consulta_min} onChange={(e) => setForm({ ...form, duracion_consulta_min: e.target.value })} style={input} /></Field>
            <Field label="% Liquidación (opcional)"><input type="number" min={0} max={100} step={1} value={form.porcentaje_liquidacion} onChange={(e) => setForm({ ...form, porcentaje_liquidacion: e.target.value })} style={input} /></Field>
          </div>
          <Field label="Sedes donde atiende">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {sedes.data?.map((s: any) => (
                <label key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.sedes.includes(s.id)} onChange={(e) => {
                    setForm((f: any) => ({
                      ...f, sedes: e.target.checked ? [...f.sedes, s.id] : f.sedes.filter((x: string) => x !== s.id),
                    }))
                  }} />
                  {s.nombre}
                </label>
              ))}
            </div>
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" onClick={() => setShowNuevo(false)} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={crear.isPending} style={btnPrimary}>{crear.isPending ? 'Creando...' : 'Crear profesional'}</button>
          </div>
        </form>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (profs ?? []).length === 0 ? <Empty texto="Sin profesionales." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Apellido y nombre</th>
                <th style={th}>Matrícula</th>
                <th style={th}>Especialidad</th>
                <th style={th}>Sedes</th>
                <th style={th}>Duración</th>
                <th style={th}>Turnos</th>
              </tr>
            </thead>
            <tbody>
              {profs?.map((p: any) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>
                    <Link href={`/admin/profesionales/${p.id}`} style={{ color: 'var(--teal)', fontWeight: 500 }}>
                      {p.usuario.apellido}, {p.usuario.nombre}
                    </Link>
                  </td>
                  <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 11 }}>{p.matricula}</code></td>
                  <td style={td}>{p.especialidad.nombre}{p.subespecialidad && ` · ${p.subespecialidad}`}</td>
                  <td style={td}>{p.sedes.map((s: any) => s.sede.nombre).join(', ') || '—'}</td>
                  <td style={td}>{p.duracion_consulta_min ?? 30} min</td>
                  <td style={td}>{p._count?.turnos ?? 0}</td>
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

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)' }
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }
