'use client'

import { useEffect, useState } from 'react'

interface Log {
  id: string
  accion: string
  entidad: string
  entidad_id: string | null
  descripcion: string | null
  ip: string | null
  created_at: string
  usuario: { id: string; nombre: string; apellido: string | null; email: string; rol: string } | null
}

export default function AuditoriaPage() {
  const [data, setData] = useState<Log[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
    fetch(`${apiBase}/auditoria?limit=200`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`API ${r.status}`)))
      .then((d) => { setData(d.data ?? []); setTotal(d.total ?? 0) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4, color: 'var(--noir)' }}>Auditoría</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Log inmutable de todas las acciones sobre datos clínicos. Solo lectura.
      </p>
      {error && <div style={{ padding: 12, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>Error: {error}</div>}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <div style={empty}>Cargando...</div>
        ) : data.length === 0 ? (
          <div style={empty}>Sin eventos auditados todavía.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Fecha</th>
                <th style={th}>Usuario</th>
                <th style={th}>Acción</th>
                <th style={th}>Entidad</th>
                <th style={th}>ID</th>
                <th style={th}>IP</th>
              </tr>
            </thead>
            <tbody>
              {data.map((l) => (
                <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{new Date(l.created_at).toLocaleString('es-AR')}</td>
                  <td style={td}>{l.usuario ? `${l.usuario.nombre} ${l.usuario.apellido ?? ''}`.trim() : '—'}<br /><span style={{ color: 'var(--muted)', fontSize: 11 }}>{l.usuario?.rol}</span></td>
                  <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--teal)' }}>{l.accion}</code></td>
                  <td style={td}>{l.entidad}</td>
                  <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--muted)' }}>{l.entidad_id?.slice(-8) ?? '—'}</code></td>
                  <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 11, color: 'var(--muted)' }}>{l.ip ?? '—'}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>{total} eventos · mostrando últimos 200</div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--noir)' }
const empty: React.CSSProperties = { padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }
