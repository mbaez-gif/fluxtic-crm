'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthContext }    from '@/components/auth/AuthProvider'
import { PageHeader }        from '@/components/layout/PageHeader'
import { Spinner }           from '@/components/ui'
import { db }                from '@/lib/firebase/config'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import {
  calcularSaldos, getPeriodoActual, formatMonto,
} from '@/lib/firebase/admin'
import type { Gasto, CompensacionPago, SaldoSocio } from '@/types/admin'
import { SOCIOS, GASTO_ESTADO_LABEL, MONEDA_SYMBOL } from '@/types/admin'
import { cn } from '@/lib/utils'
import { format, isAfter, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import {
  Plus, Upload, FileText, TrendingDown, CreditCard,
  AlertTriangle, CheckCircle, Clock, ArrowRight,
  ChevronLeft, ChevronRight, Users, BarChart3,
} from 'lucide-react'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date()
}

// ── Stat card ─────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color = 'teal' }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; color?: 'teal' | 'blue' | 'amber' | 'red' | 'green'
}) {
  const colors = {
    teal:  'text-flux-teal  bg-flux-tealGlow',
    blue:  'text-blue-400   bg-blue-950/40',
    amber: 'text-amber-400  bg-amber-950/40',
    red:   'text-red-400    bg-red-950/40',
    green: 'text-green-400  bg-green-950/40',
  }
  return (
    <div className="flux-card">
      <div className="flex items-start justify-between mb-3">
        <p className="text-2xs text-flux-text3 uppercase tracking-widest">{label}</p>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', colors[color])}>
          {icon}
        </div>
      </div>
      <p className="font-display text-xl font-bold text-flux-white">{value}</p>
      {sub && <p className="text-2xs text-flux-text3 mt-1">{sub}</p>}
    </div>
  )
}

// ── Saldo socio card ──────────────────────────────────────
function SaldoCard({ saldo }: { saldo: SaldoSocio }) {
  const socio  = SOCIOS.find(s => s.uid === saldo.uid)
  const color  = saldo.saldo > 0 ? '#22D3A0' : saldo.saldo < 0 ? '#F43F5E' : '#9AA3C2'
  const label  = saldo.saldo > 0 ? 'Le deben' : saldo.saldo < 0 ? 'Debe' : 'Al día'

  return (
    <div className="flux-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-flux-bg"
          style={{ backgroundColor: socio?.color ?? '#00D4A8' }}>
          {saldo.nombre.charAt(0)}
        </div>
        <div>
          <p className="font-medium text-flux-text1 text-sm">{saldo.nombre}</p>
          <p className="text-2xs" style={{ color }}>{label}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="font-display font-bold text-sm" style={{ color }}>
            {saldo.saldo === 0 ? '—' : formatMonto(Math.abs(saldo.saldo), 'ARS')}
          </p>
        </div>
      </div>
      <div className="space-y-1.5 border-t border-flux-border pt-3">
        <div className="flex justify-between text-xs">
          <span className="text-flux-text3">Pagó</span>
          <span className="text-flux-text1 font-medium">{formatMonto(saldo.totalPagado, 'ARS')}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-flux-text3">Le corresponde</span>
          <span className="text-flux-text1 font-medium">{formatMonto(saldo.totalCorresponde, 'ARS')}</span>
        </div>
      </div>
    </div>
  )
}

// ── Compensación card ─────────────────────────────────────
function CompensacionCard({ comp }: { comp: CompensacionPago }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-950/20 border border-amber-800/30 rounded-xl">
      <div className="w-7 h-7 rounded-full bg-red-950 flex items-center justify-center text-xs font-bold text-red-400">
        {comp.deNombre.charAt(0)}
      </div>
      <ArrowRight size={14} className="text-amber-400 shrink-0" />
      <div className="w-7 h-7 rounded-full bg-green-950 flex items-center justify-center text-xs font-bold text-green-400">
        {comp.aNombre.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-flux-text1">
          <span className="font-medium text-red-400">{comp.deNombre}</span>
          {' le paga a '}
          <span className="font-medium text-green-400">{comp.aNombre}</span>
        </p>
      </div>
      <p className="text-sm font-bold text-amber-400 shrink-0">
        {formatMonto(comp.monto, comp.moneda)}
      </p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user, profile } = useAuthContext()
  const [periodo,  setPeriodo]  = useState(getPeriodoActual())
  const [gastos,   setGastos]   = useState<Gasto[]>([])
  const [loading,  setLoading]  = useState(true)

  const loadGastos = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const q    = query(collection(db, 'adminGastos'), where('periodo', '==', periodo))
      const snap = await getDocs(q)
      setGastos(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Gasto))
    } finally {
      setLoading(false)
    }
  }, [user, periodo])

  useEffect(() => { loadGastos() }, [loadGastos])

  const gastosActivos = gastos.filter(g => g.estado !== 'cancelled')
  const { saldos, compensaciones } = calcularSaldos(gastosActivos)

  const totalARS    = gastosActivos.filter(g => g.moneda === 'ARS').reduce((a, g) => a + g.importe, 0)
  const totalUSD    = gastosActivos.filter(g => g.moneda === 'USD').reduce((a, g) => a + g.importe, 0)
  const sinComprob  = gastosActivos.filter(g => !g.tieneComprobante).length
  const pendAprov   = gastosActivos.filter(g => g.approvalStatus === 'pending').length
  const pendPago    = gastosActivos.filter(g => g.estado === 'pending_payment').length

  // Top categorías
  const catCount: Record<string, number> = {}
  for (const g of gastosActivos) {
    catCount[g.categoriaNombre] = (catCount[g.categoriaNombre] ?? 0) + g.importe
  }
  const topCats = Object.entries(catCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  function changePeriodo(delta: number) {
    const [y, m] = periodo.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setPeriodo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const periodoLabel = (() => {
    const [y, m] = periodo.split('-').map(Number)
    return format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: es })
  })()

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Administración"
        subtitle="Control de gastos, saldos y cierre mensual"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/gastos/nuevo" className="btn-ghost flex items-center gap-2 text-sm">
              <Plus size={14} /> Nuevo gasto
            </Link>
            <Link href="/admin/gastos/subir" className="btn-primary flex items-center gap-2 text-sm">
              <Upload size={14} /> Subir factura
            </Link>
          </div>
        }
      />

      <div className="px-8 pb-10 space-y-6">

        {/* Period selector */}
        <div className="flex items-center gap-3">
          <button onClick={() => changePeriodo(-1)} className="btn-ghost p-2">
            <ChevronLeft size={16} />
          </button>
          <div className="flux-card px-6 py-2 text-center min-w-[180px]">
            <p className="font-display font-bold text-flux-white capitalize">{periodoLabel}</p>
            <p className="text-2xs text-flux-text3">{periodo}</p>
          </div>
          <button onClick={() => changePeriodo(1)} className="btn-ghost p-2">
            <ChevronRight size={16} />
          </button>
          <Link href="/admin/cierre" className="btn-ghost flex items-center gap-2 text-xs ml-2">
            <FileText size={13} /> Ver cierre mensual
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={28} /></div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              <StatCard
                label="Total gastado ARS"
                value={formatMonto(totalARS, 'ARS')}
                sub={`${gastosActivos.length} gastos`}
                icon={<TrendingDown size={15} />}
                color="teal"
              />
              <StatCard
                label="Total gastado USD"
                value={formatMonto(totalUSD, 'USD')}
                sub="Sin convertir a ARS"
                icon={<TrendingDown size={15} />}
                color="blue"
              />
              <StatCard
                label="Sin comprobante"
                value={sinComprob}
                sub={sinComprob > 0 ? 'Requieren adjunto' : 'Todo documentado'}
                icon={<AlertTriangle size={15} />}
                color={sinComprob > 0 ? 'amber' : 'green'}
              />
              <StatCard
                label="Pendientes"
                value={pendPago + pendAprov}
                sub={`${pendPago} pago · ${pendAprov} aprobación`}
                icon={<Clock size={15} />}
                color={pendPago + pendAprov > 0 ? 'amber' : 'green'}
              />
            </div>

            {/* Saldos por socio */}
            <div>
              <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Users size={12} /> Saldos por socio
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {saldos.map(s => <SaldoCard key={s.uid} saldo={s} />)}
              </div>
            </div>

            {/* Compensaciones */}
            {compensaciones.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">
                  Transferencias para saldar cuentas
                </h2>
                <div className="space-y-2">
                  {compensaciones.map((c, i) => (
                    <CompensacionCard key={i} comp={c} />
                  ))}
                </div>
              </div>
            )}

            {/* Top categorías */}
            {topCats.length > 0 && (
              <div>
                <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <BarChart3 size={12} /> Top categorías del mes
                </h2>
                <div className="flux-card space-y-3">
                  {topCats.map(([cat, monto]) => {
                    const pct = totalARS > 0 ? (monto / totalARS) * 100 : 0
                    return (
                      <div key={cat}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-flux-text2">{cat}</span>
                          <span className="text-flux-text1 font-medium">
                            {formatMonto(monto, 'ARS')}
                            <span className="text-flux-text3 ml-1">({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="h-1.5 bg-flux-muted rounded-full overflow-hidden">
                          <div className="h-full bg-flux-teal rounded-full transition-all"
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Últimos gastos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest">
                  Últimos gastos del período
                </h2>
                <Link href="/admin/gastos" className="text-xs text-flux-teal hover:underline flex items-center gap-1">
                  Ver todos <ArrowRight size={11} />
                </Link>
              </div>
              {gastosActivos.length === 0 ? (
                <div className="flux-card text-center py-10">
                  <TrendingDown size={32} className="text-flux-text3 mx-auto mb-3" />
                  <p className="text-sm text-flux-text2">Sin gastos en {periodoLabel}</p>
                  <Link href="/admin/gastos/nuevo" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
                    <Plus size={14} /> Cargar primer gasto
                  </Link>
                </div>
              ) : (
                <div className="flux-card p-0 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-flux-border">
                        {['Fecha', 'Proveedor', 'Categoría', 'Importe', 'Pagó', 'Estado'].map(h => (
                          <th key={h} className="text-left text-2xs font-medium text-flux-text3 uppercase tracking-widest px-4 py-3">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gastosActivos.slice(0, 10).map(g => (
                        <tr key={g.id} className="border-b border-flux-border/50 hover:bg-flux-muted/20 transition-colors">
                          <td className="px-4 py-3 text-xs text-flux-text3">
                            {format(toDate(g.fecha), 'dd/MM', { locale: es })}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm text-flux-text1 font-medium truncate max-w-[140px]">{g.proveedorNombre}</p>
                            <p className="text-2xs text-flux-text3 truncate max-w-[140px]">{g.descripcion}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-flux-text2">{g.categoriaNombre}</td>
                          <td className="px-4 py-3 font-medium text-flux-teal text-sm">
                            {MONEDA_SYMBOL[g.moneda]}{g.importe.toLocaleString('es-AR')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-flux-muted flex items-center justify-center text-2xs font-bold text-flux-teal">
                                {g.pagadoPorNombre.charAt(0)}
                              </div>
                              <span className="text-xs text-flux-text2">{g.pagadoPorNombre}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'text-2xs px-2 py-0.5 rounded-full font-medium',
                              g.estado === 'paid' || g.estado === 'approved'
                                ? 'bg-flux-tealGlow text-flux-teal'
                                : g.estado === 'cancelled' || g.estado === 'rejected'
                                ? 'bg-red-950/40 text-red-400'
                                : 'bg-amber-950/40 text-amber-400'
                            )}>
                              {GASTO_ESTADO_LABEL[g.estado]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
