'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import styles from './reportes.module.css'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'

type Periodo = 'semana' | 'mes' | '3meses' | 'anio'

interface Resumen {
  facturacion: { total: number; delta: number }
  turnos: { total: number; delta: number }
  clientes_nuevos: { total: number; delta: number }
  ticket_promedio: { total: number; delta: number }
}

interface TopServicio { id: string; nombre: string; cantidad: number; facturacion: number }
interface Comision { id: string; nombre: string; apellido: string; cantidad: number; facturacion: number; comision: number }
interface Conversion { origen: string; cantidad: number; porcentaje: number }
interface MedioPago { medio: string; cantidad: number; total: number; porcentaje: number }

const ORIGEN_LABEL: Record<string, string> = {
  MANUAL: 'Manual', WHATSAPP: 'WhatsApp', INSTAGRAM_DM: 'Instagram',
  INSTAGRAM_COMENTARIO: 'Instagram', TIENDANUBE: 'Tienda Nube', BOCA_A_BOCA: 'Boca a boca',
}
const ORIGEN_COLOR: Record<string, string> = {
  INSTAGRAM_DM: '#A68660', INSTAGRAM_COMENTARIO: '#A68660',
  WHATSAPP: '#8BA888', TIENDANUBE: '#B89860',
  BOCA_A_BOCA: '#D4957A', MANUAL: '#8C847A',
}
const MEDIO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo', TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Débito', CREDITO: 'Crédito', MERCADOPAGO: 'MercadoPago',
}

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [servicios, setServicios] = useState<TopServicio[]>([])
  const [comisiones, setComisiones] = useState<Comision[]>([])
  const [conversion, setConversion] = useState<Conversion[]>([])
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([])
  const [serie, setSerie] = useState<{ fecha: string; total: number }[]>([])
  const [pctComision, setPctComision] = useState(15)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        fetch(`${API_BASE}/reportes/resumen?periodo=${periodo}`).then(r => r.json()),
        fetch(`${API_BASE}/reportes/top-servicios?periodo=${periodo}`).then(r => r.json()),
        fetch(`${API_BASE}/reportes/comisiones?periodo=${periodo}&porcentaje=${pctComision}`).then(r => r.json()),
        fetch(`${API_BASE}/reportes/conversion-canal?periodo=${periodo}`).then(r => r.json()),
        fetch(`${API_BASE}/reportes/medios-pago?periodo=${periodo}`).then(r => r.json()),
        fetch(`${API_BASE}/ventas/stats?periodo=${periodo}`).then(r => r.json()).catch(() => ({})),
      ])
      setResumen(r1)
      setServicios(r2.data ?? [])
      setComisiones(r3.data ?? [])
      setConversion(r4.data ?? [])
      setMediosPago(r5.data ?? [])
      setSerie(r6.serie ?? [])
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [periodo, pctComision])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Reportes</h1>
          <p className={styles.pageSub}>Análisis del negocio · Datos reales</p>
        </div>
      </div>

      <div className={styles.periodoTabs}>
        {(['semana', 'mes', '3meses', 'anio'] as Periodo[]).map(p => (
          <button key={p} className={periodo === p ? styles.tabActive : styles.tab} onClick={() => setPeriodo(p)}>
            {p === 'semana' ? 'Esta semana' : p === 'mes' ? 'Este mes' : p === '3meses' ? '3 meses' : 'Este año'}
          </button>
        ))}
      </div>

      {loading ? <div className={styles.loading}>Cargando reportes…</div> : (
        <>
          <div className={styles.kpiGrid}>
            <KPICard label="Facturación" value={`$${(resumen?.facturacion.total ?? 0).toLocaleString('es-AR')}`} delta={resumen?.facturacion.delta ?? 0} accent="#C8A882" />
            <KPICard label="Turnos realizados" value={String(resumen?.turnos.total ?? 0)} delta={resumen?.turnos.delta ?? 0} accent="#8BA888" />
            <KPICard label="Clientes nuevas" value={String(resumen?.clientes_nuevos.total ?? 0)} delta={resumen?.clientes_nuevos.delta ?? 0} accent="#B89860" />
            <KPICard label="Ticket promedio" value={`$${(resumen?.ticket_promedio.total ?? 0).toLocaleString('es-AR')}`} delta={resumen?.ticket_promedio.delta ?? 0} accent="#D4957A" />
          </div>

          {/* Facturación time series */}
          {serie.length > 0 && (
            <div className={styles.card} style={{ marginBottom: 16 }}>
              <div className={styles.cardHead}><span className={styles.cardTitle}>Facturación <em>diaria</em></span></div>
              <div className={styles.cardBody}>
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={serie} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE5" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#8C847A' }} tickFormatter={v => v.slice(5)} />
                      <YAxis tick={{ fontSize: 10, fill: '#8C847A' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
                      <Tooltip
                        formatter={(v: number) => [`$${v.toLocaleString('es-AR')}`, 'Facturación']}
                        labelFormatter={l => `Fecha: ${l}`}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4DDD6' }}
                      />
                      <Line type="monotone" dataKey="total" stroke="#C8A882" strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div className={styles.grid2}>
            {/* Top servicios bar chart */}
            <div className={styles.card}>
              <div className={styles.cardHead}><span className={styles.cardTitle}>Top <em>servicios</em></span></div>
              <div className={styles.cardBody}>
                {servicios.length === 0 ? <div className={styles.empty}>Sin turnos completados</div> : (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={servicios.slice(0, 6).map(s => ({ nombre: s.nombre.length > 16 ? s.nombre.slice(0, 14) + '…' : s.nombre, cantidad: s.cantidad, facturacion: s.facturacion }))}
                        layout="vertical"
                        margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE5" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#8C847A' }} />
                        <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10, fill: '#8C847A' }} width={90} />
                        <Tooltip
                          formatter={(v: number, name: string) => [name === 'facturacion' ? `$${v.toLocaleString('es-AR')}` : v, name === 'facturacion' ? 'Facturación' : 'Cantidad']}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4DDD6' }}
                        />
                        <Bar dataKey="cantidad" fill="#C8A882" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>Comisiones <em>por profesional</em></span>
                <div className={styles.comisionInput}>
                  <input type="number" min="0" max="100" value={pctComision}
                    onChange={e => setPctComision(Number(e.target.value) || 0)} className={styles.pctInp} />
                  <span>%</span>
                </div>
              </div>
              <div className={styles.cardBody}>
                {comisiones.length === 0 ? <div className={styles.empty}>Sin turnos completados</div> : (
                  <table className={styles.tbl}>
                    <thead><tr><th>Profesional</th><th>Servicios</th><th>Comisión</th></tr></thead>
                    <tbody>
                      {comisiones.map(c => (
                        <tr key={c.id}>
                          <td><div className={styles.profCell}>
                            <div className={styles.profAv}>{c.nombre[0]}</div>
                            <span>{c.nombre} {c.apellido}</span>
                          </div></td>
                          <td className={styles.tblMuted}>{c.cantidad}</td>
                          <td className={styles.fwMed} style={{ color: '#8BA888' }}>
                            ${Math.round(c.comision).toLocaleString('es-AR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className={styles.grid2}>
            {/* Canal Pie chart */}
            <div className={styles.card}>
              <div className={styles.cardHead}><span className={styles.cardTitle}>Conversión <em>por canal</em></span></div>
              <div className={styles.cardBody}>
                {conversion.length === 0 ? <div className={styles.empty}>Sin clientes nuevas</div> : (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={conversion.map(c => ({ name: ORIGEN_LABEL[c.origen] ?? c.origen, value: c.cantidad, color: ORIGEN_COLOR[c.origen] || '#8C847A' }))}
                          cx="50%" cy="50%"
                          innerRadius={55} outerRadius={85}
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {conversion.map((c, i) => (
                            <Cell key={i} fill={ORIGEN_COLOR[c.origen] || '#8C847A'} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number, name: string) => [v, name]}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4DDD6' }}
                        />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Medios pago Pie chart */}
            <div className={styles.card}>
              <div className={styles.cardHead}><span className={styles.cardTitle}>Medios de <em>pago</em></span></div>
              <div className={styles.cardBody}>
                {mediosPago.length === 0 ? <div className={styles.empty}>Sin ventas registradas</div> : (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={mediosPago.map(m => ({ name: MEDIO_LABEL[m.medio] ?? m.medio, value: m.total }))}
                          cx="50%" cy="50%"
                          innerRadius={55} outerRadius={85}
                          dataKey="value"
                          paddingAngle={2}
                        >
                          {mediosPago.map((_, i) => (
                            <Cell key={i} fill={['#C8A882','#8BA888','#B89860','#D4957A','#8C847A'][i % 5]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => [`$${v.toLocaleString('es-AR')}`, 'Total']}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4DDD6' }}
                        />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KPICard({ label, value, delta, accent }: { label: string; value: string; delta: number; accent: string }) {
  const cls = delta > 0 ? styles.deltaUp : delta < 0 ? styles.deltaDn : styles.deltaNt
  const icon = delta > 0 ? '↑' : delta < 0 ? '↓' : '—'
  return (
    <div className={styles.kpiCard} style={{ '--accent': accent } as any}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiVal}>{value}</div>
      <div className={`${styles.kpiDelta} ${cls}`}>{icon} {Math.abs(delta)}% vs período anterior</div>
    </div>
  )
}
