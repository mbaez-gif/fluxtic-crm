'use client'

import { useState } from 'react'
import { useReporte } from '@/hooks/useApi'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const COLORS = ['#0F766E', '#2563EB', '#16A34A', '#D97706', '#DC2626', '#0284C7', '#64748B']

type Tab = 'resumen' | 'top-practicas' | 'productividad' | 'cobertura' | 'pacientes' | 'efectividad'

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))

  const desdeISO = new Date(desde).toISOString()
  const hastaISO = new Date(new Date(hasta).setHours(23, 59, 59, 999)).toISOString()

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Reportes clínico-operativos</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Métricas de operación, productividad y facturación</p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Período:</span>
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} style={input} />
        <span style={{ color: 'var(--muted)' }}>–</span>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} style={input} />
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 30); setDesde(d.toISOString().slice(0, 10)); setHasta(new Date().toISOString().slice(0, 10)) }} style={btnSecondary}>Últimos 30 días</button>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          ['resumen', 'Resumen'],
          ['top-practicas', 'Top prácticas'],
          ['productividad', 'Productividad'],
          ['cobertura', 'Facturación por cobertura'],
          ['pacientes', 'Pacientes'],
          ['efectividad', 'Efectividad recordatorios'],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', border: 'none', background: 'transparent',
            fontSize: 13, fontWeight: tab === k ? 600 : 400,
            color: tab === k ? 'var(--teal)' : 'var(--muted)',
            borderBottom: `2px solid ${tab === k ? 'var(--teal)' : 'transparent'}`, cursor: 'pointer', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'resumen' && <Resumen desde={desdeISO} hasta={hastaISO} />}
      {tab === 'top-practicas' && <TopPracticas desde={desdeISO} hasta={hastaISO} />}
      {tab === 'productividad' && <Productividad desde={desdeISO} hasta={hastaISO} />}
      {tab === 'cobertura' && <FacturacionCobertura desde={desdeISO} hasta={hastaISO} />}
      {tab === 'pacientes' && <Pacientes desde={desdeISO} hasta={hastaISO} />}
      {tab === 'efectividad' && <Efectividad desde={desdeISO} hasta={hastaISO} />}
    </div>
  )
}

function Resumen({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useReporte('resumen', desde, hasta)
  if (isLoading) return <Loading />
  if (!data) return <Empty />
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <Kpi label="Turnos totales" value={data.turnos_total} />
        <Kpi label="Atendidos" value={data.atendidos} color="var(--salud)" />
        <Kpi label="No-show" value={data.no_show} color="var(--danger)" />
        <Kpi label="Cancelados" value={data.cancelados} color="var(--warning)" />
        <Kpi label="Tasa atención" value={`${data.tasa_atencion}%`} color="var(--salud)" />
        <Kpi label="Tasa no-show" value={`${data.tasa_no_show}%`} color={data.tasa_no_show > 15 ? 'var(--danger)' : 'var(--noir)'} />
        <Kpi label="Ingresos" value={`$${data.ingresos.total.toLocaleString('es-AR')}`} color="var(--teal)" />
        <Kpi label="Pacientes nuevos" value={data.pacientes_nuevos} />
      </div>

      <Card titulo="Distribución de estados">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={[
                { name: 'Atendidos', value: data.atendidos },
                { name: 'No-show', value: data.no_show },
                { name: 'Cancelados', value: data.cancelados },
              ]}
              cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label
            >
              <Cell fill="#16A34A" />
              <Cell fill="#DC2626" />
              <Cell fill="#D97706" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

function TopPracticas({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useReporte('top-prestaciones', desde, hasta)
  if (isLoading) return <Loading />
  if (!data || data.length === 0) return <Empty />
  return (
    <Card titulo="Top 10 prestaciones del período">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
          <XAxis type="number" stroke="var(--muted)" />
          <YAxis type="category" dataKey="prestacion_nombre" stroke="var(--muted)" width={150} fontSize={11} />
          <Tooltip />
          <Bar dataKey="cantidad" fill="var(--teal)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function Productividad({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useReporte('productividad-profesional', desde, hasta)
  if (isLoading) return <Loading />
  if (!data || data.length === 0) return <Empty />
  return (
    <Card titulo="Productividad por profesional">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
          <XAxis dataKey="profesional" stroke="var(--muted)" angle={-20} textAnchor="end" height={80} fontSize={10} />
          <YAxis stroke="var(--muted)" />
          <Tooltip />
          <Legend />
          <Bar dataKey="atendidos" fill="#16A34A" stackId="a" />
          <Bar dataKey="no_show" fill="#DC2626" stackId="a" />
          <Bar dataKey="cancelados" fill="#D97706" stackId="a" />
          <Bar dataKey="confirmados" fill="#2563EB" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  )
}

function FacturacionCobertura({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useReporte('facturacion-cobertura', desde, hasta)
  if (isLoading) return <Loading />
  if (!data) return <Empty />
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card titulo="Por cobertura">
        {data.por_cobertura.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={data.por_cobertura} dataKey="monto" nameKey="cobertura_nombre" cx="50%" cy="50%" outerRadius={90} label={(e: any) => `${e.cobertura_nombre}: $${e.monto.toLocaleString('es-AR')}`}>
                {data.por_cobertura.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )}
      </Card>
      <Card titulo="Por medio de pago">
        {data.por_medio.length === 0 ? <Empty /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.por_medio}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
              <XAxis dataKey="medio" stroke="var(--muted)" fontSize={11} />
              <YAxis stroke="var(--muted)" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => `$${Number(v).toLocaleString('es-AR')}`} />
              <Bar dataKey="monto" fill="var(--teal)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  )
}

function Pacientes({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useReporte('pacientes', desde, hasta)
  if (isLoading) return <Loading />
  if (!data) return <Empty />
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <Kpi label="Pacientes nuevos" value={data.nuevos} color="var(--teal)" />
        <Kpi label="Recurrentes" value={data.recurrentes} color="var(--salud)" />
        <Kpi label="Inactivos (180+ días)" value={data.inactivos} color="var(--warning)" />
        <Kpi label="Total activos" value={data.total_activos} />
      </div>
      <Card titulo="Composición del período">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie data={[
              { name: 'Nuevos', value: data.nuevos },
              { name: 'Recurrentes', value: data.recurrentes },
            ]} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value" label>
              <Cell fill="#0F766E" />
              <Cell fill="#16A34A" />
            </Pie>
            <Tooltip /><Legend />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

function Efectividad({ desde, hasta }: { desde: string; hasta: string }) {
  const { data, isLoading } = useReporte('efectividad-recordatorios', desde, hasta)
  if (isLoading) return <Loading />
  if (!data) return <Empty />

  const ventanas: Array<{ key: '48h' | '24h' | '2h'; label: string }> = [
    { key: '48h', label: '48 horas antes' },
    { key: '24h', label: '24 horas antes' },
    { key: '2h', label: '2 horas antes' },
  ]
  const chartData = ventanas.map((v) => ({
    name: v.label,
    Con: data[`ventana_${v.key}`]?.con?.tasa ?? 0,
    Sin: data[`ventana_${v.key}`]?.sin?.tasa ?? 0,
  }))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {ventanas.map((v) => {
          const d = data[`ventana_${v.key}`]
          if (!d) return null
          return (
            <Card key={v.key} titulo={v.label}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Kpi label="Con (tasa)" value={`${d.con.tasa}%`} color="var(--salud)" />
                <Kpi label="Sin (tasa)" value={`${d.sin.tasa}%`} color={d.sin.tasa < d.con.tasa ? 'var(--danger)' : 'var(--noir)'} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                Con recordatorio: {d.con.atendidos}/{d.con.total} · Sin: {d.sin.atendidos}/{d.sin.total}
              </div>
            </Card>
          )
        })}
      </div>
      <Card titulo="Comparativa por ventana">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-2)" />
            <XAxis dataKey="name" stroke="var(--muted)" />
            <YAxis domain={[0, 100]} stroke="var(--muted)" tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Legend />
            <Bar dataKey="Con" fill="var(--teal)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Sin" fill="var(--danger)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 12 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Kpi({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: color ?? 'var(--noir)' }}>{value}</div>
    </div>
  )
}
function Empty() { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Sin datos en este período</div> }
function Loading() { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Cargando reporte...</div> }

const input: React.CSSProperties = { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)' }
const btnSecondary: React.CSSProperties = { padding: '6px 12px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }
