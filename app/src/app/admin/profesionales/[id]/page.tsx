'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useProfesional, useAgregarHorario, useEliminarHorario, useSedes } from '@/hooks/useApi'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export default function ProfesionalFichaPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const { data: prof, isLoading, error } = useProfesional(id)
  const sedes = useSedes()
  const agregarHorario = useAgregarHorario()
  const eliminarHorario = useEliminarHorario()
  const [tab, setTab] = useState<'datos' | 'horarios' | 'prestaciones'>('datos')
  const [nuevoH, setNuevoH] = useState({ dia_semana: '1', hora_inicio: '09:00', hora_fin: '13:00', sede_id: '' })

  if (isLoading) return <div style={{ padding: 24 }}>Cargando...</div>
  if (error || !prof) return <div style={{ padding: 24, color: 'var(--danger)' }}>Error</div>

  async function addHorario(e: React.FormEvent) {
    e.preventDefault()
    await agregarHorario.mutateAsync({
      profesional_id: id,
      dia_semana: Number(nuevoH.dia_semana),
      hora_inicio: nuevoH.hora_inicio,
      hora_fin: nuevoH.hora_fin,
      sede_id: nuevoH.sede_id || null,
    })
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <Link href="/admin/profesionales" style={{ fontSize: 13, color: 'var(--muted)' }}>← Profesionales</Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, marginBottom: 20 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--teal)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 600 }}>
          {prof.usuario.nombre[0]}{(prof.usuario.apellido ?? '')[0]}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>{prof.usuario.apellido}, {prof.usuario.nombre}</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            <code style={{ fontFamily: 'var(--font-m)' }}>MN {prof.matricula}</code> · {prof.especialidad.nombre}
            {prof.subespecialidad && ` · ${prof.subespecialidad}`} · {prof.usuario.email}
          </div>
        </div>
        <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: prof.usuario.activo ? 'var(--salud-l)' : 'var(--bg-2)', color: prof.usuario.activo ? 'var(--salud)' : 'var(--muted)' }}>
          {prof.usuario.activo ? 'Activo' : 'Inactivo'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {([['datos', 'Datos'], ['horarios', `Horarios (${prof.horarios?.length ?? 0})`], ['prestaciones', `Prestaciones (${prof.prestaciones?.length ?? 0})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', border: 'none', background: 'transparent',
            fontSize: 13, fontWeight: tab === k ? 600 : 400,
            color: tab === k ? 'var(--teal)' : 'var(--muted)',
            borderBottom: `2px solid ${tab === k ? 'var(--teal)' : 'transparent'}`, cursor: 'pointer', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'datos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card titulo="Identificación">
            <Row k="Email" v={prof.usuario.email} />
            <Row k="Teléfono" v={prof.usuario.telefono ?? '—'} />
            <Row k="Rol" v={prof.usuario.rol} />
            <Row k="Matrícula" v={prof.matricula} />
            <Row k="Especialidad" v={prof.especialidad.nombre} />
            <Row k="Subespecialidad" v={prof.subespecialidad ?? '—'} />
          </Card>
          <Card titulo="Configuración profesional">
            <Row k="Duración estándar consulta" v={`${prof.duracion_consulta_min} min`} />
            <Row k="% Liquidación" v={prof.porcentaje_liquidacion ? `${Number(prof.porcentaje_liquidacion)}%` : '—'} />
            <Row k="Sedes asignadas" v={prof.sedes?.map((s: any) => s.sede.nombre).join(', ') || '—'} />
            <Row k="Color en agenda" v={prof.color_agenda ?? '—'} />
          </Card>
          {prof.bio && (
            <Card titulo="Bio">
              <div style={{ fontSize: 13, color: 'var(--noir)', whiteSpace: 'pre-wrap' }}>{prof.bio}</div>
            </Card>
          )}
        </div>
      )}

      {tab === 'horarios' && (
        <div>
          <Card titulo="Agregar horario">
            <form onSubmit={addHorario} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 0.5fr', gap: 10 }}>
              <select value={nuevoH.dia_semana} onChange={(e) => setNuevoH({ ...nuevoH, dia_semana: e.target.value })} style={input}>
                {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input type="time" value={nuevoH.hora_inicio} onChange={(e) => setNuevoH({ ...nuevoH, hora_inicio: e.target.value })} style={input} />
              <input type="time" value={nuevoH.hora_fin} onChange={(e) => setNuevoH({ ...nuevoH, hora_fin: e.target.value })} style={input} />
              <select value={nuevoH.sede_id} onChange={(e) => setNuevoH({ ...nuevoH, sede_id: e.target.value })} style={input}>
                <option value="">Todas las sedes</option>
                {sedes.data?.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
              <button type="submit" style={btnPrimary}>+</button>
            </form>
          </Card>

          <Card titulo="Horarios configurados">
            {(prof.horarios ?? []).length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin horarios. Agregá franjas arriba.</div>
            ) : prof.horarios.map((h: any) => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-2)', fontSize: 13 }}>
                <div>
                  <strong>{DIAS[h.dia_semana]}</strong> · {h.hora_inicio} a {h.hora_fin}
                  {h.sede_id && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>· sede específica</span>}
                </div>
                <button onClick={() => eliminarHorario.mutate(h.id)} style={iconBtn}>quitar</button>
              </div>
            ))}
          </Card>
        </div>
      )}

      {tab === 'prestaciones' && (
        <Card titulo="Prestaciones habilitadas">
          {(prof.prestaciones ?? []).length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin prestaciones asignadas. Asignalas desde <Link href="/admin/prestaciones" style={{ color: 'var(--teal)' }}>Prestaciones</Link>.</div>
          ) : prof.prestaciones.map((pp: any) => (
            <div key={pp.prestacion.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-2)', fontSize: 13 }}>
              <strong>{pp.prestacion.nombre}</strong>
              <span style={{ color: 'var(--muted)', marginLeft: 8 }}>· {pp.prestacion.duracion_min} min · ${Number(pp.prestacion.precio_particular).toLocaleString('es-AR')}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid var(--border-2)' }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <span style={{ color: 'var(--noir)', fontWeight: 500 }}>{v}</span>
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }
