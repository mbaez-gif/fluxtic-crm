'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePacientes, useCoberturas } from '@/hooks/useApi'

const SEGMENTOS = [
  { value: '', label: 'Todos los segmentos' },
  { value: 'VIP', label: 'VIP', color: 'var(--warning)' },
  { value: 'CRONICO', label: 'Crónico', color: 'var(--info)' },
  { value: 'SEGUIMIENTO', label: 'En seguimiento', color: 'var(--clinical)' },
  { value: 'PARTICULAR', label: 'Particular' },
  { value: 'COBERTURA', label: 'Con cobertura' },
  { value: 'GENERAL', label: 'General' },
]

const CANALES = [
  { value: '', label: 'Todos los canales' },
  { value: 'RECEPCION', label: 'Recepción' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'WEB', label: 'Web' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'REFERIDO', label: 'Referido' },
  { value: 'CAMPANIA', label: 'Campaña' },
  { value: 'PORTAL_PACIENTE', label: 'Portal paciente' },
]

const ESTADOS = [
  { value: '', label: 'Todos los estados' },
  { value: 'ACTIVO', label: 'Activo' },
  { value: 'INACTIVO', label: 'Inactivo' },
  { value: 'EN_SEGUIMIENTO', label: 'En seguimiento' },
  { value: 'BLOQUEADO', label: 'Bloqueado' },
]

export default function PacientesPage() {
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [segmento, setSegmento] = useState('')
  const [canalOrigen, setCanalOrigen] = useState('')
  const [coberturaId, setCoberturaId] = useState('')

  const { data, isLoading, error } = usePacientes({
    q: q || undefined,
    estado: estado || undefined,
    segmento: segmento || undefined,
    canal_origen: canalOrigen || undefined,
    cobertura_id: coberturaId || undefined,
  })
  const coberturas = useCoberturas()

  const total = data?.total ?? 0
  const pacientes = data?.data ?? []

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--noir)' }}>Pacientes</h1>
        <Link href="/admin/pacientes/nuevo" style={btnPrimary}>+ Nuevo paciente</Link>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>{total} pacientes registrados</p>

      {/* Filtros */}
      <div style={{
        display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 10, marginBottom: 16,
        background: 'var(--surface)', padding: 12, border: '1px solid var(--border)', borderRadius: 12,
      }}>
        <input
          type="text"
          placeholder="Buscar por DNI, apellido o nombre..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={inputStyle}
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={inputStyle}>
          {ESTADOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={segmento} onChange={(e) => setSegmento(e.target.value)} style={inputStyle}>
          {SEGMENTOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={canalOrigen} onChange={(e) => setCanalOrigen(e.target.value)} style={inputStyle}>
          {CANALES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={coberturaId} onChange={(e) => setCoberturaId(e.target.value)} style={inputStyle}>
          <option value="">Todas las coberturas</option>
          {coberturas.data?.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          Error al cargar pacientes: {(error as any)?.message ?? 'desconocido'}
        </div>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? (
          <Empty texto="Cargando..." />
        ) : pacientes.length === 0 ? (
          <Empty texto="No hay pacientes que coincidan con los filtros." />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>DNI</th>
                <th style={th}>Apellido y nombre</th>
                <th style={th}>Teléfono</th>
                <th style={th}>Cobertura</th>
                <th style={th}>Segmento</th>
                <th style={th}>Canal</th>
                <th style={th}>Estado</th>
                <th style={th}>Alertas</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p: any) => {
                const cob = p.coberturas?.[0]
                const alertasCriticas = (p.alertas_clinicas ?? []).filter((a: any) => a.severidad === 'CRITICA').length
                const alertasTotal = (p.alertas_clinicas ?? []).length
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>
                      <Link href={`/admin/pacientes/${p.id}`} style={{ color: 'var(--teal)', fontWeight: 500 }}>{p.dni}</Link>
                    </td>
                    <td style={td}>{p.apellido}, {p.nombre}</td>
                    <td style={td}>{p.telefono ?? '—'}</td>
                    <td style={td}>
                      {cob ? <>{cob.cobertura.nombre} <span style={{ color: 'var(--muted)' }}>· {cob.numero_afiliado}</span></> : <span style={{ color: 'var(--muted)' }}>Particular</span>}
                    </td>
                    <td style={td}><Segmento valor={p.segmento} /></td>
                    <td style={td}><span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.canal_origen}</span></td>
                    <td style={td}><span className={`status-badge s-${p.estado.toLowerCase().replace('_', '-')}`}>{p.estado}</span></td>
                    <td style={td}>
                      {alertasTotal === 0 ? <span style={{ color: 'var(--muted)' }}>—</span> : (
                        <span style={{
                          padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                          background: alertasCriticas > 0 ? 'var(--danger-l)' : 'var(--warning-l)',
                          color: alertasCriticas > 0 ? 'var(--danger)' : 'var(--warning)',
                        }}>
                          {alertasCriticas > 0 ? `⚠ ${alertasCriticas} crítica${alertasCriticas > 1 ? 's' : ''}` : `${alertasTotal} aviso${alertasTotal > 1 ? 's' : ''}`}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Segmento({ valor }: { valor: string }) {
  if (!valor || valor === 'GENERAL') return <span style={{ color: 'var(--muted)', fontSize: 11 }}>General</span>
  const colores: Record<string, { bg: string; fg: string }> = {
    VIP:         { bg: 'var(--warning-l)', fg: 'var(--warning)' },
    CRONICO:     { bg: 'var(--info-l)', fg: 'var(--info)' },
    SEGUIMIENTO: { bg: 'var(--clinical-l)', fg: 'var(--clinical)' },
    PARTICULAR:  { bg: 'var(--bg-2)', fg: 'var(--noir)' },
    COBERTURA:   { bg: 'var(--teal-l)', fg: 'var(--teal-d)' },
  }
  const c = colores[valor] ?? { bg: 'var(--bg-2)', fg: 'var(--noir)' }
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.fg, textTransform: 'capitalize',
    }}>
      {valor.toLowerCase()}
    </span>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)', verticalAlign: 'middle' }
const inputStyle: React.CSSProperties = { padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)' }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500 }

function Empty({ texto }: { texto: string }) {
  return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div>
}
