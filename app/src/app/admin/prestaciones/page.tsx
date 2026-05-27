'use client'

import { useState } from 'react'
import { usePrestaciones, useEspecialidades, useCrearPrestacion, useActualizarPrestacion } from '@/hooks/useApi'

export default function PrestacionesPage() {
  const [filtroEsp, setFiltroEsp] = useState('')
  const { data: prestaciones, isLoading } = usePrestaciones(filtroEsp || undefined)
  const especialidades = useEspecialidades()
  const crear = useCrearPrestacion()
  const actualizar = useActualizarPrestacion()

  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState<any>({
    codigo: '', nombre: '', descripcion: '', especialidad_id: '',
    duracion_min: 30, precio_particular: 0,
    requiere_autorizacion: false, requiere_consentimiento: false,
    requiere_preparacion: false, instrucciones_preparacion: '',
    permite_telemedicina: false, activa: true,
  })

  function abrirNueva() {
    setEditando('nueva')
    setForm({
      codigo: '', nombre: '', descripcion: '', especialidad_id: '',
      duracion_min: 30, precio_particular: 0,
      requiere_autorizacion: false, requiere_consentimiento: false,
      requiere_preparacion: false, instrucciones_preparacion: '',
      permite_telemedicina: false, activa: true,
    })
  }
  function abrirEditar(p: any) {
    setEditando(p.id)
    setForm({
      codigo: p.codigo ?? '', nombre: p.nombre, descripcion: p.descripcion ?? '',
      especialidad_id: p.especialidad_id ?? '',
      duracion_min: p.duracion_min, precio_particular: Number(p.precio_particular),
      requiere_autorizacion: p.requiere_autorizacion, requiere_consentimiento: p.requiere_consentimiento,
      requiere_preparacion: p.requiere_preparacion, instrucciones_preparacion: p.instrucciones_preparacion ?? '',
      permite_telemedicina: p.permite_telemedicina, activa: p.activa,
    })
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const body: any = {
      ...form,
      codigo: form.codigo || null,
      descripcion: form.descripcion || null,
      especialidad_id: form.especialidad_id || null,
      instrucciones_preparacion: form.instrucciones_preparacion || null,
      duracion_min: Number(form.duracion_min),
      precio_particular: Number(form.precio_particular),
    }
    if (editando === 'nueva') await crear.mutateAsync(body)
    else if (editando) await actualizar.mutateAsync({ id: editando, body })
    setEditando(null)
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Prestaciones</h1>
        <button onClick={abrirNueva} style={btnPrimary}>+ Nueva prestación</button>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Consultas, prácticas, estudios y procedimientos disponibles</p>

      <div style={{ marginBottom: 16 }}>
        <select value={filtroEsp} onChange={(e) => setFiltroEsp(e.target.value)} style={{ ...input, maxWidth: 280 }}>
          <option value="">Todas las especialidades</option>
          {especialidades.data?.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      </div>

      {editando && (
        <form onSubmit={guardar} style={{ background: 'var(--surface)', border: '1px solid var(--teal)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
            {editando === 'nueva' ? 'Nueva prestación' : 'Editar prestación'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <Field label="Código (opcional)"><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} style={input} /></Field>
            <Field label="Nombre *"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required style={input} /></Field>
            <Field label="Especialidad">
              <select value={form.especialidad_id} onChange={(e) => setForm({ ...form, especialidad_id: e.target.value })} style={input}>
                <option value="">Sin especialidad</option>
                {especialidades.data?.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
            <Field label="Duración (min) *">
              <input type="number" min={5} step={5} value={form.duracion_min} onChange={(e) => setForm({ ...form, duracion_min: e.target.value })} required style={input} />
            </Field>
            <Field label="Precio particular ($)">
              <input type="number" min={0} step={100} value={form.precio_particular} onChange={(e) => setForm({ ...form, precio_particular: e.target.value })} style={input} />
            </Field>
            <Field label="Activa">
              <select value={form.activa ? '1' : '0'} onChange={(e) => setForm({ ...form, activa: e.target.value === '1' })} style={input}>
                <option value="1">Activa</option>
                <option value="0">Inactiva</option>
              </select>
            </Field>
          </div>

          <Field label="Descripción">
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} style={input} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 12, marginTop: 8 }}>
            <Check label="Requiere autorización" v={form.requiere_autorizacion} onChange={(v) => setForm({ ...form, requiere_autorizacion: v })} />
            <Check label="Requiere consentimiento" v={form.requiere_consentimiento} onChange={(v) => setForm({ ...form, requiere_consentimiento: v })} />
            <Check label="Requiere preparación previa" v={form.requiere_preparacion} onChange={(v) => setForm({ ...form, requiere_preparacion: v })} />
            <Check label="Permite telemedicina" v={form.permite_telemedicina} onChange={(v) => setForm({ ...form, permite_telemedicina: v })} />
          </div>

          {form.requiere_preparacion && (
            <Field label="Instrucciones de preparación (se envían al paciente)">
              <textarea value={form.instrucciones_preparacion} onChange={(e) => setForm({ ...form, instrucciones_preparacion: e.target.value })} rows={2} style={{ ...input, resize: 'vertical' }} />
            </Field>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" onClick={() => setEditando(null)} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={crear.isPending || actualizar.isPending} style={btnPrimary}>
              {editando === 'nueva' ? 'Crear' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (prestaciones ?? []).length === 0 ? <Empty texto="Sin prestaciones para este filtro." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Código</th>
                <th style={th}>Nombre</th>
                <th style={th}>Especialidad</th>
                <th style={th}>Duración</th>
                <th style={th}>Precio</th>
                <th style={th}>Flags</th>
                <th style={th}>Activa</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {prestaciones?.map((p: any) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--muted)' }}>{p.codigo ?? '—'}</code></td>
                  <td style={td}><span style={{ fontWeight: 500 }}>{p.nombre}</span></td>
                  <td style={td}>{p.especialidad?.nombre ?? '—'}</td>
                  <td style={td}>{p.duracion_min} min</td>
                  <td style={td}>${Number(p.precio_particular).toLocaleString('es-AR')}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {p.requiere_autorizacion && <Flag color="warning">Autoriz.</Flag>}
                      {p.requiere_consentimiento && <Flag color="info">Cons.</Flag>}
                      {p.requiere_preparacion && <Flag color="info">Prep.</Flag>}
                      {p.permite_telemedicina && <Flag color="teal">📹 Tel.</Flag>}
                    </div>
                  </td>
                  <td style={td}>{p.activa ? <span style={{ color: 'var(--salud)' }}>✓</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={td}><button onClick={() => abrirEditar(p)} style={iconBtn}>Editar</button></td>
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

function Check({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: 'var(--noir)', cursor: 'pointer' }}>
      <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Flag({ children, color }: { children: React.ReactNode; color: 'warning' | 'info' | 'teal' }) {
  const cs: Record<string, { bg: string; fg: string }> = {
    warning: { bg: 'var(--warning-l)', fg: 'var(--warning)' },
    info: { bg: 'var(--info-l)', fg: 'var(--info)' },
    teal: { bg: 'var(--teal-l)', fg: 'var(--teal-d)' },
  }
  const c = cs[color]
  return <span style={{ padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: c.bg, color: c.fg }}>{children}</span>
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)', verticalAlign: 'middle' }
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--teal)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }
