'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import styles from './profesionales.module.css'
import DashboardTabs from '../DashboardTabs'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'

type Periodo = 'semana' | 'mes' | 'anio'

interface Profesional {
  id: string
  nombre: string
  apellido: string
  color: string
  cantidad: number
  facturacion: number
  comision: number
  top_servicio: string
}

interface ProfesionalesData {
  data: Profesional[]
  periodo: string
  empty?: boolean
}

const PERIODO_LABELS: Record<Periodo, string> = {
  semana: 'Semana',
  mes: 'Este mes',
  anio: 'Este año',
}

function formatMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString('es-AR')}`
}

function formatFull(n: number) {
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E4DDD6', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <p style={{ color: '#8C847A', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#1C1814', fontWeight: 500 }}>
          <span style={{ color: '#8C847A', marginRight: 4 }}>{p.name}:</span>
          {formatFull(p.value)}
        </p>
      ))}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className={styles.profCard}>
      <div className={styles.profCardHead}>
        <div className={`${styles.skeleton}`} style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0 }} />
        <div className={`${styles.skeleton}`} style={{ width: '60%', height: 14, borderRadius: 3 }} />
      </div>
      <div className={styles.profCardBody}>
        <div className={`${styles.skeleton}`} style={{ width: '40%', height: 10, borderRadius: 3, marginBottom: 8 }} />
        <div className={`${styles.skeleton}`} style={{ width: '55%', height: 10, borderRadius: 3, marginBottom: 8 }} />
        <div className={`${styles.skeleton}`} style={{ width: '48%', height: 10, borderRadius: 3, marginBottom: 8 }} />
        <div className={`${styles.skeleton}`} style={{ width: '35%', height: 10, borderRadius: 3 }} />
      </div>
    </div>
  )
}

export default function ProfesionalesDashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [comisionPct, setComisionPct] = useState<number>(15)
  const [comisionInput, setComisionInput] = useState<string>('15')
  const [data, setData] = useState<ProfesionalesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`${API}/dashboard/profesionales?periodo=${periodo}&porcentaje=${comisionPct}`)
      if (!r.ok) throw new Error(`Error ${r.status}`)
      setData(await r.json())
    } catch (e: any) {
      setError(e.message ?? 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [periodo, comisionPct])

  useEffect(() => { cargar() }, [cargar])

  function handleComisionBlur() {
    const val = parseFloat(comisionInput)
    if (!isNaN(val) && val >= 0 && val <= 100) {
      setComisionPct(val)
    } else {
      setComisionInput(String(comisionPct))
    }
  }

  function handleComisionKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleComisionBlur()
  }

  const profs = data?.data ?? []

  const chartData = profs.map(p => ({
    name: `${p.nombre} ${p.apellido}`,
    facturacion: p.facturacion,
    comision: Math.round(p.facturacion * comisionPct / 100),
    color: p.color,
  }))

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Dashboard · Profesionales</h1>
          <p className={styles.sub}>Rendimiento y comisiones · datos en tiempo real</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          <div className={styles.comisionField}>
            <label className={styles.comisionLabel}>Comisión %</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={comisionInput}
              onChange={e => setComisionInput(e.target.value)}
              onBlur={handleComisionBlur}
              onKeyDown={handleComisionKeyDown}
              className={styles.comisionInput}
            />
          </div>
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

      {/* Cards por profesional */}
      <div className={styles.profGrid}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : data?.empty || !profs.length ? (
          <div className={styles.emptyFull}>
            Aún no hay ventas asociadas a profesionales en este período.
          </div>
        ) : (
          profs.map(p => {
            const comisionCalc = Math.round(p.facturacion * comisionPct / 100)
            return (
              <div key={p.id} className={styles.profCard}>
                <div className={styles.profCardHead}>
                  <span className={styles.profDot} style={{ background: p.color || '#A68660' }} />
                  <span className={styles.profName}>{p.nombre} {p.apellido}</span>
                </div>
                <div className={styles.profCardBody}>
                  <div className={styles.profStat}>
                    <span className={styles.profStatLabel}>Ventas</span>
                    <span className={styles.profStatVal}>{p.cantidad}</span>
                  </div>
                  <div className={styles.profStat}>
                    <span className={styles.profStatLabel}>Facturación</span>
                    <span className={styles.profStatVal}>{formatMoney(p.facturacion)}</span>
                  </div>
                  <div className={styles.profStat}>
                    <span className={styles.profStatLabel}>Comisión ({comisionPct}%)</span>
                    <span className={`${styles.profStatVal} ${styles.profStatComision}`}>
                      {formatMoney(comisionCalc)}
                    </span>
                  </div>
                  {p.top_servicio && p.top_servicio !== '—' && (
                    <div className={styles.profStat}>
                      <span className={styles.profStatLabel}>Top servicio</span>
                      <span className={styles.profStatVal} style={{ fontSize: 11 }}>{p.top_servicio}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* BarChart comparativa */}
      <div className={styles.card} style={{ marginTop: 20 }}>
        <div className={styles.cardHead}>
          <span className={styles.cardTitle}>Comparativa de facturación</span>
          <span className={styles.cardSub}>{PERIODO_LABELS[periodo]}</span>
        </div>
        <div className={styles.cardBody}>
          {loading ? (
            <div className={styles.chartLoadingWrap}>
              <div className={`${styles.skeleton}`} style={{ width: '100%', height: 220, borderRadius: 8 }} />
            </div>
          ) : !chartData.length ? (
            <div className={styles.empty}>Sin datos para el período</div>
          ) : (
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F0EC" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#8C847A' }}
                    tickFormatter={v => v.split(' ')[0]}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#8C847A' }}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span style={{ fontSize: 10, color: '#8C847A' }}>
                      {v === 'facturacion' ? 'Facturación' : `Comisión (${comisionPct}%)`}
                    </span>}
                  />
                  <Bar dataKey="facturacion" fill="#A68660" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="comision" fill="#8BA888" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Tabla resumen */}
      {!loading && profs.length ? (
        <div className={styles.card} style={{ marginTop: 16 }}>
          <div className={styles.cardHead}>
            <span className={styles.cardTitle}>Resumen de comisiones</span>
            <span className={styles.cardSub}>{PERIODO_LABELS[periodo]} · {comisionPct}% comisión</span>
          </div>
          <div className={styles.cardBodyNoPad}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Profesional</th>
                  <th className={styles.right}>Ventas</th>
                  <th className={styles.right}>Facturación</th>
                  <th className={styles.right}>Comisión</th>
                </tr>
              </thead>
              <tbody>
                {profs.map(p => {
                  const comisionCalc = Math.round(p.facturacion * comisionPct / 100)
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.tableNameCell}>
                          <span className={styles.tableDot} style={{ background: p.color || '#A68660' }} />
                          {p.nombre} {p.apellido}
                        </div>
                      </td>
                      <td className={styles.right}>{p.cantidad}</td>
                      <td className={styles.right}>{formatMoney(p.facturacion)}</td>
                      <td className={`${styles.right} ${styles.comisionCell}`}>{formatMoney(comisionCalc)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className={styles.footLabel}>Total</td>
                  <td className={`${styles.right} ${styles.footVal}`}>
                    {profs.reduce((acc, p) => acc + p.cantidad, 0)}
                  </td>
                  <td className={`${styles.right} ${styles.footVal}`}>
                    {formatMoney(profs.reduce((acc, p) => acc + p.facturacion, 0))}
                  </td>
                  <td className={`${styles.right} ${styles.footVal} ${styles.comisionCell}`}>
                    {formatMoney(profs.reduce((acc, p) => acc + Math.round(p.facturacion * comisionPct / 100), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
