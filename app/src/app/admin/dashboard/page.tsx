'use client'

import { useEffect, useState } from 'react'

interface Kpis {
  atendidos_hoy: number
  pendientes_hoy: number
  no_show_hoy: number
  ingresos_hoy: number
  facturacion_pendiente: number
  pacientes_activos: number
  profesionales_activos: number
  stock_critico: number
}

interface TurnoLite {
  id: string
  fecha_hora: string
  estado: string
  paciente: { nombre: string; apellido: string; dni: string }
  profesional: { usuario: { nombre: string; apellido: string }; especialidad: { nombre: string } }
  prestacion: { nombre: string } | null
  sede: { nombre: string }
}

export default function DashboardPage() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [turnos, setTurnos] = useState<TurnoLite[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
    fetch(`${apiBase}/dashboard`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`API ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setKpis(d.kpis)
        setTurnos(d.turnos_hoy ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ padding: '28px 28px 60px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4, color: 'var(--noir)' }}>
        Dashboard clínico
      </h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
        Vista general del día — turnos, ingresos y alertas
      </p>

      {error && (
        <div style={{ padding: 16, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          No se pudo cargar: {error} · Levantá el API y seedeá la DB.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 28 }}>
        <Kpi label="Atendidos hoy"    value={kpis?.atendidos_hoy} loading={loading} color="var(--salud)" />
        <Kpi label="Pendientes hoy"   value={kpis?.pendientes_hoy} loading={loading} color="var(--clinical)" />
        <Kpi label="No-show hoy"      value={kpis?.no_show_hoy} loading={loading} color="var(--danger)" />
        <Kpi label="Ingresos hoy"     value={kpis ? `$${kpis.ingresos_hoy.toLocaleString('es-AR')}` : undefined} loading={loading} color="var(--teal)" />
        <Kpi label="Por cobrar"       value={kpis ? `$${kpis.facturacion_pendiente.toLocaleString('es-AR')}` : undefined} loading={loading} color="var(--warning)" />
        <Kpi label="Pacientes activos"  value={kpis?.pacientes_activos} loading={loading} />
        <Kpi label="Profesionales"      value={kpis?.profesionales_activos} loading={loading} />
        <Kpi label="Stock crítico"      value={kpis?.stock_critico} loading={loading} color={kpis?.stock_critico ? 'var(--warning)' : undefined} />
      </div>

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--noir)' }}>
        Turnos de hoy
      </h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <Empty texto="Cargando..." />
        ) : turnos.length === 0 ? (
          <Empty texto="Sin turnos para hoy" />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Hora</th>
                <th style={th}>Paciente</th>
                <th style={th}>Profesional</th>
                <th style={th}>Prestación</th>
                <th style={th}>Sede</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{new Date(t.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td style={td}>{t.paciente.apellido}, {t.paciente.nombre} <span style={{ color: 'var(--muted)' }}>· {t.paciente.dni}</span></td>
                  <td style={td}>{t.profesional.usuario.apellido}, {t.profesional.usuario.nombre} <span style={{ color: 'var(--muted)' }}>· {t.profesional.especialidad.nombre}</span></td>
                  <td style={td}>{t.prestacion?.nombre ?? '—'}</td>
                  <td style={td}>{t.sede.nombre}</td>
                  <td style={td}><span className={`status-badge s-${t.estado.toLowerCase().replace('_', '-')}`}>{t.estado.replace('_', ' ')}</span></td>
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

function Kpi({ label, value, loading, color }: { label: string; value: number | string | undefined; loading: boolean; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: color ?? 'var(--noir)' }}>
        {loading ? '—' : value ?? 0}
      </div>
    </div>
  )
}

function Empty({ texto }: { texto: string }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
      {texto}
    </div>
  )
}
