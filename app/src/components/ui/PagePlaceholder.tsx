'use client'

import { ReactNode } from 'react'

interface Props {
  titulo: string
  descripcion?: string
  endpoint?: string
  proximamente?: string[]
  children?: ReactNode
}

export default function PagePlaceholder({ titulo, descripcion, endpoint, proximamente, children }: Props) {
  return (
    <div style={{ padding: '32px 28px', maxWidth: 1100 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, color: 'var(--noir)', marginBottom: 4 }}>
        {titulo}
      </h1>
      {descripcion && (
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>{descripcion}</p>
      )}
      {endpoint && (
        <div style={{
          display: 'inline-block', padding: '6px 12px', background: 'var(--teal-l)',
          borderRadius: 6, fontSize: 12, color: 'var(--teal-d)', fontFamily: 'var(--font-m)',
          marginBottom: 16,
        }}>
          API · {endpoint}
        </div>
      )}
      {children ?? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 16, color: 'var(--noir)', fontWeight: 500, marginBottom: 8 }}>
            Pantalla en construcción
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            El módulo está activo en el backend. La UI completa llega en próximos sprints.
          </div>
          {proximamente && proximamente.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: 'var(--ink, var(--noir))', textAlign: 'left', display: 'inline-block' }}>
              {proximamente.map((p, i) => (
                <li key={i} style={{ padding: '4px 0' }}>· {p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
