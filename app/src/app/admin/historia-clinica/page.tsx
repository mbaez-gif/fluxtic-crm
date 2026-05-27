'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useBuscarPacientes } from '@/hooks/useApi'

export default function HistoriaClinicaBuscadorPage() {
  const [q, setQ] = useState('')
  const { data, isLoading } = useBuscarPacientes(q)

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Historia clínica</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Buscá al paciente cuya historia clínica querés abrir. Todo acceso queda registrado en auditoría.
      </p>

      <div style={{ background: 'var(--warning-l)', color: 'var(--warning)', padding: 12, borderRadius: 8, fontSize: 12, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <div>
          <strong>Acceso auditado.</strong> Buscar y abrir una HC queda asentado en el log con tu usuario, IP y fecha.
        </div>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por DNI, apellido o nombre (mínimo 2 caracteres)..."
        autoFocus
        style={{
          width: '100%', padding: '14px 16px', border: '1px solid var(--border)',
          borderRadius: 12, fontSize: 14, marginBottom: 16, background: 'var(--surface)',
        }}
      />

      {q.length < 2 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Escribí al menos 2 caracteres para buscar.
        </div>
      ) : isLoading ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Buscando...</div>
      ) : (data?.data ?? []).length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Ningún paciente coincide con "{q}".
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {(data?.data ?? []).slice(0, 30).map((p: any) => (
            <Link
              key={p.id}
              href={`/admin/historia-clinica/paciente/${p.id}`}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', borderBottom: '1px solid var(--border-2)',
                fontSize: 13, color: 'var(--noir)',
              }}
            >
              <div>
                <strong>{p.apellido}, {p.nombre}</strong>
                <span style={{ color: 'var(--muted)', marginLeft: 8 }}>DNI {p.dni}</span>
              </div>
              <span style={{ color: 'var(--teal)', fontWeight: 500, fontSize: 12 }}>Abrir HC →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
