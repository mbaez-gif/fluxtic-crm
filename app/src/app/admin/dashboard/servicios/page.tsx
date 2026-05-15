'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import styles from './servicios.module.css'
import DashboardTabs from '../DashboardTabs'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com'

type Periodo = 'semana' | 'mes' | 'anio'

interface Servicio {
  id: string
  nombre: string
  categoria: string
  cantidad: number
  ingresos: number
  participacion: number
  duracion_min: number
  precio: number
}

interface ServiciosData {
  data: Servicio[]
  periodo: string
}

const PERIODO_LABELS: Record<Periodo, string> = {
  semana: 'Semana',
  mes: 'Este mes',
  anio: 'Este año',
}

const CHART_COLORS = ['#A68660', '#8BA888', '#D4957A', '#B89860', '#8C847A', '#C4A882', '#7A9880']

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('es-AR')}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E4DDD6', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: '#8C847A', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#1C1814', fontWeight: 500 }}>
          {p.value}
        </p>
      ))}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className={styles.kpiCard}>
      <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
      <div className={`${styles.skeleton} ${styles.skeletonVal}`} />
      <div className={`${styles.skeleton} ${styles.skeletonSub}`} />
    </div>
  )
}

export default function ServiciosDashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [data, setData] = useState<ServiciosData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${API}/dashboard/servicios?periodo=${periodo}`)
      if (!r.ok) throw new Error(`Error ${r.status}`)
      setData(await r.json())
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  const servicios = data?.data ?? []
  const topServicio = servicios[0]?.nombre ?? '—'
  const totalServicios = servicios.reduce((acc, s) => acc + s.cantidad, 0)
  const totalIngresos = servicios.reduce((acc, s) => acc + s.ingresos, 0)
  const ticketPromedio = totalServicios > 0 ? Math.round(totalIngresos / totalServicios) : 0

  // Agrupar por categoría para el pie chart
  const porCategoriaMap: Record<string, { cantidad: number; ingresos: number }> = {}
  for (const s of servicios) {
    if (!porCategoriaMap[s.categoria]) porCategoriaMap[s.categoria] = { cantidad: 0, ingresos: 0 }
    porCategoriaMap[s.categoria].cantidad += s.cantidad
    porCategoriaMap[s.categoria].ingresos += s.ingresos
  }
  const porCategoria = Object.entries(porCategoriaMap).map(([categoria, v]) => ({ categoria, ...v }))

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard · Servicios</h1>
          <p className={styles.sub}>Análisis de servicios · datos en tiempo real</p>
        </div>
        <div className={styles.periodoBar}>
          {(['semana', 'mes', 'anio'] as Periodo[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`${styles.periodoBtn} ${periodo === p ? styles.periodoBtnActive : ''}`}
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <DashboardTabs />
      </div>

      {error && (
        <div className={styles.errorBanner}>
          {error} — <button onClick={cargar} className={styles.retryBtn}>Reintentar</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Total servicios</div>
              <div className={styles.kpiVal}>{totalServicios}</div>
              <div className={styles.kpiSub}>{PERIODO_LABELS[periodo]}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Más pedido</div>
              <div className={`${styles.kpiVal} ${styles.kpiValSmall}`}>{topServicio}</div>
              <div className={styles.kpiSub}>{servicios[0]?.cantidad ?? 0} veces</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Facturación</div>
              <div className={styles.kpiVal}>{formatMoney(totalIngresos)}</div>
              <div className={styles.kpiSub}>{PERIODO_LABELS[periodo]}</div>
            </div>
            <div className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Ticket promedio</div>
              <div className={styles.kpiVal}>{formatMoney(ticketPromedio)}</div>
              <div className={styles.kpiSub}>por servicio</div>
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      <div className={styles.chartsGrid}>
        {/* Top servicios — BarChart horizontal */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Top servicios por cantidad</span>
            <span className={styles.cardSub}>{PERIODO_LABELS[periodo]}</span>
          </div>
          <div className={styles.cardBody}>
            {loading ? (
              <div className={styles.chartSkeleton}>
                {[100, 80, 65, 50, 40].map((w, i) => (
                  <div key={i} className={styles.barSkeletonRow}>
                    <div className={`${styles.skeleton}`} style={{ width: 90, height: 10, borderRadius: 3 }} />
                    <div className={`${styles.skeleton}`} style={{ width: `${w}%`, height: 14, borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            ) : !servicios.length ? (
              <div className={styles.empty}>Sin datos para el período</div>
            ) : (
              <div className={styles.chartWrap}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={servicios.slice(0, 8)}
                    layout="vertical"
                    margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F0EC" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#8C847A' }} />
                    <YAxis
                      dataKey="nombre"
                      type="category"
                      tick={{ fontSize: 10, fill: '#8C847A' }}
                      width={120}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="cantidad" fill="#A68660" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Por categoría — PieChart */}
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Distribución por categoría</span>
            <span className={styles.cardSub}>{PERIODO_LABELS[periodo]}</span>
          </div>
          <div className={styles.cardBody}>
            {loading ? (
              <div className={styles.pieSkeleton}>
                <div className={`${styles.skeleton}`} style={{ width: 160, height: 160, borderRadius: '50%' }} />
              </div>
            ) : !porCategoria.length ? (
              <div className={styles.empty}>Sin datos para el período</div>
            ) : (
              <div className={styles.chartWrapPie}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={porCategoria.map(c => ({ name: c.categoria, value: c.cantidad }))}
                      cx="50%"
                      cy="45%"
                      innerRadius={55}
                      outerRadius={90}
                      dataKey="value"
                      paddingAngle={2}
                    >
                      {porCategoria.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, 'veces']} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      formatter={(v) => <span style={{ fontSize: 10, color: '#8C847A' }}>{v}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabla detalle */}
      <div className={styles.card} style={{ marginTop: 16 }}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Detalle de servicios</span>
          <span className={styles.cardSub}>{PERIODO_LABELS[periodo]}</span>
        </div>
        <div className={styles.cardBodyNoPad}>
          {loading ? (
            <div className={styles.tableSkeleton}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={styles.tableSkeletonRow}>
                  <div className={`${styles.skeleton}`} style={{ width: '30%', height: 12, borderRadius: 3 }} />
                  <div className={`${styles.skeleton}`} style={{ width: '12%', height: 12, borderRadius: 3 }} />
                  <div className={`${styles.skeleton}`} style={{ width: '18%', height: 12, borderRadius: 3 }} />
                  <div className={`${styles.skeleton}`} style={{ width: '15%', height: 12, borderRadius: 3 }} />
                </div>
              ))}
            </div>
          ) : !servicios.length ? (
            <div className={styles.empty}>Sin datos para el período</div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th className={styles.right}>Cantidad</th>
                  <th className={styles.right}>Facturado</th>
                  <th className={styles.right}>Participación</th>
                </tr>
              </thead>
              <tbody>
                {servicios.filter(s => s.cantidad > 0).map(s => (
                  <tr key={s.id}>
                    <td>{s.nombre}</td>
                    <td className={styles.right}>{s.cantidad}</td>
                    <td className={styles.right}>{formatMoney(s.ingresos)}</td>
                    <td className={styles.right}>{s.participacion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
