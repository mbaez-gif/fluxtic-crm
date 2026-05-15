'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import styles from './dashboard.module.css'
import DashboardTabs from './DashboardTabs'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'

type Periodo = 'hoy' | 'semana' | 'mes' | 'anio'

interface DashData {
  periodo: string
  kpis: {
    facturacion:     { total: number; delta: number }
    ventas:          { total: number; delta: number }
    ticket_promedio: { total: number; delta: number }
    turnos:          { total: number; delta: number }
    clientes_nuevos: { total: number; delta: number }
    stock_critico:   { total: number }
  }
  turnos: {
    pendientes: number; pendientes_pago_mp: number; confirmados: number
    en_curso: number; pendientes_facturar: number; completados: number
    cancelados: number; no_show: number; total: number
  }
  top_servicios: { nombre: string; categoria: string; cantidad: number }[]
  medios_pago: { medio: string; total: number; cantidad: number; pct: number }[]
  stock_critico: { id: string; nombre: string; stock_actual: number; stock_minimo: number; categoria: string }[]
  proximas_reservas: {
    id: string; fecha: string; estado: string
    cliente: string; servicio: string; profesional: string; color: string
  }[]
  serie_facturacion: { fecha: string; total: number }[]
}

const PERIODO_LABELS: Record<Periodo, string> = {
  hoy: 'Hoy', semana: 'Semana', mes: 'Este mes', anio: 'Este año',
}

const MEDIO_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Débito', CREDITO: 'Crédito', MERCADOPAGO: 'Mercado Pago',
}

const CHART_COLORS = ['#A68660', '#8BA888', '#D4957A', '#B89860', '#8C847A']

const ESTADO_CHIP: Record<string, string> = {
  PENDIENTE:                    styles.chipPendiente,
  PENDIENTE_PAGO_MP:            styles.chipPago,
  PENDIENTE_VALIDACION_MANUAL:  styles.chipPago,
  CONFIRMADO:                   styles.chipConfirmado,
  EN_CURSO:                     styles.chipEnCurso,
  COMPLETADO:                   styles.chipCompletado,
  CANCELADO:                    styles.chipCancelado,
}

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  PENDIENTE_PAGO_MP: 'Pago MP pend.',
  PENDIENTE_VALIDACION_MANUAL: 'Validar transf.',
  CONFIRMADO: 'Confirmado', EN_CURSO: 'En curso',
  COMPLETADO: 'Completado', CANCELADO: 'Cancelado',
}

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('es-AR')}`
}

function formatFull(n: number) {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

function Delta({ delta }: { delta: number }) {
  const cls = delta > 0 ? styles.deltaPos : delta < 0 ? styles.deltaNeg : styles.deltaNeutro
  const icon = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  return <span className={`${styles.kpiDelta} ${cls}`}>{icon} {Math.abs(delta)}% vs período ant.</span>
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E4DDD6', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: '#8C847A', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#1C1814', fontWeight: 500 }}>
          {p.name === 'total' ? formatFull(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

const PIE_DATA_DEF = [
  { key: 'completados',         name: 'Completados',   color: '#4A7C59' },
  { key: 'confirmados',         name: 'Confirmados',   color: '#3A7AD4' },
  { key: 'pendientes',          name: 'Pendientes',    color: '#E8AA3A' },
  { key: 'en_curso',            name: 'En curso',      color: '#A68660' },
  { key: 'cancelados',          name: 'Cancelados',    color: '#C45C5C' },
  { key: 'no_show',             name: 'No asistió',    color: '#9B7DD4' },
  { key: 'pendientes_facturar', name: 'Pend.facturar', color: '#B08030' },
  { key: 'pendientes_pago_mp',  name: 'Seña pend.',    color: '#8C847A' },
] as const

function TurnosPie({ turnos, loading }: { turnos?: DashData['turnos']; loading: boolean }) {
  if (loading || !turnos || turnos.total === 0) return null
  const pieData = PIE_DATA_DEF
    .map(d => ({ name: d.name, value: (turnos as any)[d.key] as number, color: d.color }))
    .filter(d => d.value > 0)
  return (
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v: any) => [v, '']} />
          <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 10, color: '#8C847A' }}>{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/dashboard/general?periodo=${periodo}&_=${Date.now()}`, { cache: 'no-store' })
      if (r.ok) setData(await r.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  const kpis = data?.kpis

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.sub}>Resumen operativo · datos en tiempo real</p>
        </div>
        <div className={styles.periodoBar}>
          {(['hoy', 'semana', 'mes', 'anio'] as Periodo[]).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`${styles.periodoBtn} ${periodo === p ? styles.periodoBtnActive : ''}`}>
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <DashboardTabs />
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        {[
          { label: 'Facturación', val: kpis ? formatMoney(kpis.facturacion.total) : '—', delta: kpis?.facturacion.delta },
          { label: 'Ventas',      val: kpis ? String(kpis.ventas.total)            : '—', delta: kpis?.ventas.delta },
          { label: 'Ticket prom.', val: kpis ? formatMoney(kpis.ticket_promedio.total) : '—', delta: kpis?.ticket_promedio.delta },
          { label: 'Turnos',      val: kpis ? String(kpis.turnos.total)             : '—', delta: kpis?.turnos.delta },
          { label: 'Clientes nuevos', val: kpis ? String(kpis.clientes_nuevos.total) : '—', delta: kpis?.clientes_nuevos.delta },
        ].map(({ label, val, delta }) => (
          <div key={label} className={styles.kpiCard}>
            <div className={styles.kpiLabel}>{label}</div>
            <div className={styles.kpiVal}>
              {loading ? <span className={styles.skeleton} style={{ display: 'inline-block', width: 80, height: 26 }} /> : val}
            </div>
            {!loading && delta !== undefined && <Delta delta={delta} />}
          </div>
        ))}
      </div>

      {/* Fila 1: Facturación + Estado turnos */}
      <div className={styles.mainGridWide}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Facturación</span>
            <span className={styles.cardSub}>{PERIODO_LABELS[periodo]}</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.chartWrap}>
              {loading ? <div className={styles.loading}>Cargando…</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.serie_facturacion ?? []} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradFacturacion" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#A68660" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#A68660" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0EC" vertical={false} />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#8C847A' }} tickLine={false} axisLine={false} tickFormatter={v => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#8C847A' }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#A68660"
                      strokeWidth={2.5}
                      fill="url(#gradFacturacion)"
                      dot={false}
                      activeDot={{ r: 5, fill: '#A68660', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Estado de turnos</span>
            {data && <span className={styles.cardSub}>Total: {data.turnos.total}</span>}
          </div>
          {loading ? <div className={styles.loading}>…</div> : (
            <div className={styles.estadoGrid}>
              {[
                { key: 'pendientes',          label: 'Pendientes',       cls: styles.badgePendiente   },
                { key: 'confirmados',         label: 'Confirmados',      cls: styles.badgeConfirmado  },
                { key: 'en_curso',            label: 'En curso',         cls: styles.badgeEnCurso     },
                { key: 'pendientes_facturar', label: 'Pend. facturar',   cls: styles.badgePendiente   },
                { key: 'completados',         label: 'Completados',      cls: styles.badgeCompletado  },
                { key: 'cancelados',          label: 'Cancelados',       cls: styles.badgeCancelado   },
                { key: 'no_show',             label: 'No asistió',       cls: styles.badgeCancelado   },
                { key: 'pendientes_pago_mp',  label: 'Seña pendiente',   cls: styles.badgePendiente   },
              ].map(({ key, label, cls }) => (
                <div key={key} className={`${styles.estadoBadge} ${cls}`}>
                  <span className={styles.estadoNum}>{(data?.turnos as any)?.[key] ?? 0}</span>
                  <span className={styles.estadoLbl}>{label}</span>
                </div>
              ))}
            </div>
          )}
          <div className={styles.cardBody} style={{ paddingTop: 0 }}>
            <TurnosPie turnos={data?.turnos} loading={loading} />
          </div>
        </div>
      </div>

      {/* Fila 2: Top servicios + Medios de pago */}
      <div className={styles.mainGrid}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Top servicios</span>
            <Link href="/admin/reportes" className={styles.verMas} style={{ border: 'none', padding: '0', fontSize: 11, color: 'var(--blush-d)', display: 'inline' }}>Ver reportes →</Link>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.chartWrap}>
              {loading ? <div className={styles.loading}>…</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data?.top_servicios.slice(0, 6) ?? []} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F0EC" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#8C847A' }} />
                    <YAxis dataKey="nombre" type="category" tick={{ fontSize: 10, fill: '#8C847A' }} width={110} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="cantidad" fill="#A68660" radius={[0, 4, 4, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Medios de pago</span>
          </div>
          <div className={styles.cardBody}>
            <div className={styles.chartWrap}>
              {loading ? <div className={styles.loading}>…</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(data?.medios_pago ?? []).map(m => ({ name: MEDIO_LABELS[m.medio] ?? m.medio, value: m.total }))}
                      cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" paddingAngle={2}
                    >
                      {CHART_COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [formatFull(v), '']} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 10, color: '#8C847A' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fila 3: Próximos turnos + Stock crítico */}
      <div className={styles.mainGrid}>
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Próximas reservas</span>
            <Link href="/admin/turnos/tablero" style={{ fontSize: 11, color: 'var(--blush-d)' }}>Tablero →</Link>
          </div>
          <div className={styles.cardBodyNoPad}>
            {loading ? <div className={styles.loading}>…</div> :
             !data?.proximas_reservas.length ? <div className={styles.empty}>Sin reservas próximas</div> : (
              <div className={styles.turnoList}>
                {data.proximas_reservas.slice(0, 7).map(t => (
                  <div key={t.id} className={styles.turnoRow}>
                    <span className={styles.turnoHora}>{formatHora(t.fecha)}</span>
                    <span className={styles.turnoDot} style={{ background: t.color || '#A68660' }} />
                    <div className={styles.turnoInfo}>
                      <div className={styles.turnoCliente}>{t.cliente}</div>
                      <div className={styles.turnoSub}>{t.servicio} · {t.profesional} · {formatFecha(t.fecha)}</div>
                    </div>
                    <span className={`${styles.turnoChip} ${ESTADO_CHIP[t.estado] ?? styles.chipPendiente}`}>
                      {ESTADO_LABEL[t.estado] ?? t.estado}
                    </span>
                  </div>
                ))}
                <Link href="/admin/turnos" className={styles.verMas}>Ver todos los turnos</Link>
              </div>
            )}
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Stock crítico</span>
            {kpis && kpis.stock_critico.total > 0 && (
              <span style={{ fontSize: 10, padding: '2px 8px', background: 'var(--error-l)', color: 'var(--error)', borderRadius: 10, fontWeight: 500 }}>
                {kpis.stock_critico.total} alertas
              </span>
            )}
          </div>
          <div className={styles.cardBodyNoPad}>
            {loading ? <div className={styles.loading}>…</div> :
             !data?.stock_critico.filter(p => p.stock_actual <= p.stock_minimo).length ?
               <div className={styles.empty}>Sin alertas de stock 🎉</div> : (
              data.stock_critico.filter(p => p.stock_actual <= p.stock_minimo).slice(0, 8).map(p => {
                const pct = p.stock_minimo > 0 ? Math.min(100, (p.stock_actual / p.stock_minimo) * 100) : 0
                const fillCls = pct < 30 ? styles.stockRed : styles.stockYellow
                return (
                  <div key={p.id} className={styles.stockRow}>
                    <span className={styles.stockNombre}>{p.nombre}</span>
                    <div className={styles.stockBar}>
                      <div className={`${styles.stockBarFill} ${fillCls}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={styles.stockNums}>{p.stock_actual}/{p.stock_minimo}</span>
                  </div>
                )
              })
            )}
            {!loading && <Link href="/admin/stock" className={styles.verMas}>Gestionar stock</Link>}
          </div>
        </div>
      </div>
    </div>
  )
}
