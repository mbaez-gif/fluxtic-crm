'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDashboard } from '@/hooks/useApi'

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard()

  if (isLoading) return <div style={{ padding: 24 }}>Cargando dashboard...</div>
  if (error || !data) return (
    <div style={{ padding: 24, color: 'var(--danger)' }}>
      Error al cargar: {(error as any)?.message ?? 'desconocido'}
    </div>
  )

  const k = data.kpis
  const ahora = new Date()

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--noir)' }}>Dashboard clínico</h1>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{format(ahora, "EEEE d 'de' MMMM yyyy · HH:mm", { locale: es })}</div>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Vista ejecutiva — turnos de hoy, ingresos, ocupación y alertas operativas
      </p>

      {/* KPIs row 1 — turnos del día */}
      <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Turnos de hoy</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <Kpi label="Total" value={k.total_hoy} />
        <Kpi label="Atendidos" value={k.atendidos_hoy} color="var(--salud)" />
        <Kpi label="Confirmados" value={k.confirmados_hoy} color="var(--clinical)" />
        <Kpi label="Pendientes" value={k.pendientes_hoy} color="var(--warning)" />
        <Kpi label="Cancelados" value={k.cancelados_hoy} color="var(--danger)" />
        <Kpi label="No-show" value={k.ausentes_hoy} color="var(--danger)" />
      </div>

      {/* KPIs row 2 — ingresos y comparativos */}
      <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Ingresos y operación</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
        <Kpi label="Ingresos del día" value={`$${k.ingresos_hoy.toLocaleString('es-AR')}`} color="var(--teal)" />
        <Kpi label="Ingresos del mes" value={`$${k.ingresos_mes.toLocaleString('es-AR')}`} color="var(--teal)" delta={k.ingresos_mes_delta_pct} />
        <Kpi label="Pacientes nuevos (mes)" value={k.pacientes_nuevos_mes} delta={k.pacientes_nuevos_mes_delta_pct} />
        <Kpi label="Turnos esta semana" value={k.turnos_semana} delta={k.turnos_semana_delta_pct} />
        <Kpi label="Tasa de ausentismo mes" value={`${k.tasa_ausentismo_mes}%`} color={k.tasa_ausentismo_mes > 15 ? 'var(--danger)' : 'var(--noir)'} />
        <Kpi label="Por cobrar" value={`$${k.facturacion_pendiente.toLocaleString('es-AR')}`} color="var(--warning)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Turnos del día */}
        <div style={card}>
          <Title>Turnos de hoy ({data.turnos_hoy.length})</Title>
          {data.turnos_hoy.length === 0 ? <Empty texto="Sin turnos para hoy" /> : (
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)' }}>
                  <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                    <th style={th}>Hora</th>
                    <th style={th}>Paciente</th>
                    <th style={th}>Profesional</th>
                    <th style={th}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.turnos_hoy.map((t: any) => (
                    <tr key={t.id} style={{ borderTop: '1px solid var(--border-2)' }}>
                      <td style={td}>{format(new Date(t.fecha_hora), 'HH:mm')}</td>
                      <td style={td}>
                        <strong>{t.paciente.apellido}, {t.paciente.nombre}</strong>
                        {t.paciente.segmento === 'VIP' && <span style={{ marginLeft: 6, padding: '1px 6px', background: 'var(--warning-l)', color: 'var(--warning)', fontSize: 9, borderRadius: 4, fontWeight: 600 }}>VIP</span>}
                      </td>
                      <td style={td}>{t.profesional.usuario.apellido}<br /><span style={{ color: 'var(--muted)', fontSize: 10 }}>{t.profesional.especialidad?.nombre}</span></td>
                      <td style={td}><span className={`status-badge s-${t.estado.toLowerCase().replace('_', '-')}`}>{t.estado.replace('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alertas operativas */}
        <div style={card}>
          <Title>Alertas operativas</Title>
          <AlertaOp label="Stock crítico" count={data.alertas_operativas.stock_critico} severidad="warning" href="/admin/insumos?bajo_stock=true" />
          <AlertaOp label="Comprobantes pendientes" count={data.alertas_operativas.comprobantes_pendientes_revision} severidad="info" />
          <AlertaOp label="Insumos próximos a vencer" count={data.alertas_operativas.insumos_proximos_a_vencer} severidad="warning" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Ocupación por profesional */}
        <div style={card}>
          <Title>Ocupación esta semana</Title>
          {data.ocupacion_profesional.length === 0 ? <Empty texto="Sin datos" /> : (
            <div>
              {data.ocupacion_profesional.map((o: any) => {
                const max = Math.max(...data.ocupacion_profesional.map((x: any) => x.turnos_semana))
                const pct = max > 0 ? (o.turnos_semana / max) * 100 : 0
                return (
                  <div key={o.profesional_id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span><strong>{o.profesional}</strong> <span style={{ color: 'var(--muted)' }}>· {o.especialidad}</span></span>
                      <span style={{ fontWeight: 600 }}>{o.turnos_semana} turnos</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--teal)', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top prácticas */}
        <div style={card}>
          <Title>Top prácticas del mes</Title>
          {data.top_practicas.length === 0 ? <Empty texto="Sin datos" /> : (
            <div>
              {data.top_practicas.map((p: any, idx: number) => {
                const max = data.top_practicas[0].cantidad
                const pct = (p.cantidad / max) * 100
                return (
                  <div key={p.prestacion_id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span><strong>{idx + 1}. {p.prestacion}</strong></span>
                      <span style={{ fontWeight: 600 }}>{p.cantidad}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--clinical)', borderRadius: 4 }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Próximas videoconsultas */}
      {data.proximas_videoconsultas.length > 0 && (
        <div style={card}>
          <Title>📹 Próximas videoconsultas (24 hs)</Title>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
            {data.proximas_videoconsultas.map((v: any) => (
              <div key={v.turno_id} style={{ padding: 12, background: 'var(--teal-l)', borderRadius: 10, border: '1px solid var(--teal)' }}>
                <div style={{ fontSize: 12, color: 'var(--teal-d)', fontWeight: 600, marginBottom: 4 }}>
                  {format(new Date(v.fecha_hora), "EEE d MMM HH:mm", { locale: es })}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--noir)' }}>{v.paciente}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{v.profesional}</div>
                {v.url ? (
                  <a href={v.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 500 }}>Abrir sala →</a>
                ) : (
                  <Link href={`/admin/telemedicina/turno/${v.turno_id}`} style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 500 }}>Generar link →</Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, color, delta }: { label: string; value: string | number; color?: string; delta?: number }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: color ?? 'var(--noir)' }}>{value}</div>
        {delta !== undefined && delta !== 0 && (
          <div style={{ fontSize: 11, fontWeight: 600, color: delta > 0 ? 'var(--salud)' : 'var(--danger)' }}>
            {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </div>
        )}
      </div>
    </div>
  )
}

function AlertaOp({ label, count, severidad, href }: { label: string; count: number; severidad: 'warning' | 'danger' | 'info'; href?: string }) {
  const colors = {
    warning: { bg: 'var(--warning-l)', fg: 'var(--warning)' },
    danger: { bg: 'var(--danger-l)', fg: 'var(--danger)' },
    info: { bg: 'var(--info-l)', fg: 'var(--info)' },
  }[severidad]
  const content = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: count > 0 ? colors.bg : 'var(--bg-2)', borderRadius: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: count > 0 ? colors.fg : 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: count > 0 ? colors.fg : 'var(--muted)' }}>{count}</span>
    </div>
  )
  return href ? <Link href={href} style={{ display: 'block' }}>{content}</Link> : content
}

function Title({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--noir)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>{children}</div>
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 }
const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 500, color: 'var(--muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em' }
const td: React.CSSProperties = { padding: '10px', color: 'var(--noir)', verticalAlign: 'top' }
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }
