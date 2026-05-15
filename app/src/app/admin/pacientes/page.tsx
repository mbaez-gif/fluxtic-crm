'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Paciente {
  id: string
  dni: string
  nombre: string
  apellido: string
  telefono: string | null
  email: string | null
  estado: string
  coberturas: Array<{ cobertura: { nombre: string }; numero_afiliado: string }>
}

export default function PacientesPage() {
  const [data, setData] = useState<Paciente[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
    const url = new URL(`${apiBase}/pacientes`)
    if (q) url.searchParams.set('q', q)
    setLoading(true)
    fetch(url.toString(), { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`API ${r.status}`)))
      .then((d) => { setData(d.data ?? []); setTotal(d.total ?? 0); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [q])

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--noir)' }}>Pacientes</h1>
        <Link href="/admin/pacientes/nuevo" style={btnPrimary}>+ Nuevo paciente</Link>
      </div>

      <input
        type="text"
        placeholder="Buscar por DNI, apellido o nombre..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        style={{
          width: '100%', padding: '10px 14px', border: '1px solid var(--border)',
          borderRadius: 8, fontSize: 14, marginBottom: 16, background: 'var(--surface)',
        }}
      />

      {error && <Banner color="danger" texto={`Error: ${error}`} />}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={empty}>Cargando...</div>
        ) : data.length === 0 ? (
          <div style={empty}>No hay pacientes registrados {q && `que coincidan con "${q}"`}.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>DNI</th>
                <th style={th}>Apellido y nombre</th>
                <th style={th}>Teléfono</th>
                <th style={th}>Cobertura</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                  <td style={td}><Link href={`/admin/pacientes/${p.id}`} style={{ color: 'var(--teal)' }}>{p.dni}</Link></td>
                  <td style={td}>{p.apellido}, {p.nombre}</td>
                  <td style={td}>{p.telefono ?? '—'}</td>
                  <td style={td}>{p.coberturas[0] ? `${p.coberturas[0].cobertura.nombre} · ${p.coberturas[0].numero_afiliado}` : 'Particular'}</td>
                  <td style={td}><span className={`status-badge s-${p.estado.toLowerCase()}`}>{p.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>{total} pacientes</div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)' }
const empty: React.CSSProperties = { padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500 }

function Banner({ color, texto }: { color: 'danger' | 'info'; texto: string }) {
  return (
    <div style={{
      padding: '12px 16px',
      background: color === 'danger' ? 'var(--danger-l)' : 'var(--info-l)',
      color: color === 'danger' ? 'var(--danger)' : 'var(--info)',
      borderRadius: 8, marginBottom: 12, fontSize: 13,
    }}>
      {texto}
    </div>
  )
}
