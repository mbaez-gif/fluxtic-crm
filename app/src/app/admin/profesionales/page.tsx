'use client'

import { useEffect, useState } from 'react'

interface Profesional {
  id: string
  matricula: string
  subespecialidad: string | null
  usuario: { id: string; nombre: string; apellido: string | null; email: string; activo: boolean }
  especialidad: { id: string; nombre: string }
  sedes: Array<{ sede: { id: string; nombre: string } }>
  _count: { turnos: number }
}

export default function ProfesionalesPage() {
  const [data, setData] = useState<Profesional[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
    fetch(`${apiBase}/profesionales`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`API ${r.status}`)))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4, color: 'var(--noir)' }}>Profesionales</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Médicos y coordinadores. Cada uno con matrícula, especialidad y sedes asignadas.
      </p>
      {error && <div style={{ padding: 12, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>Error: {error}</div>}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={empty}>Cargando...</div>
        ) : data.length === 0 ? (
          <div style={empty}>No hay profesionales registrados.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Apellido y nombre</th>
                <th style={th}>Matrícula</th>
                <th style={th}>Especialidad</th>
                <th style={th}>Sedes</th>
                <th style={th}>Turnos</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{p.usuario.apellido}, {p.usuario.nombre}</td>
                  <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 12 }}>MN {p.matricula}</code></td>
                  <td style={td}>{p.especialidad.nombre}{p.subespecialidad && ` · ${p.subespecialidad}`}</td>
                  <td style={td}>{p.sedes.map((s) => s.sede.nombre).join(', ') || '—'}</td>
                  <td style={td}>{p._count.turnos}</td>
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
const empty: React.CSSProperties = { padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }
