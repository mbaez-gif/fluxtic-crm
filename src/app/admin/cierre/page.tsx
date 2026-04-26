'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthContext }  from '@/components/auth/AuthProvider'
import { PageHeader }      from '@/components/layout/PageHeader'
import { Spinner }         from '@/components/ui'
import { db }              from '@/lib/firebase/config'
import { collection, query, where, getDocs } from 'firebase/firestore'
import {
  calcularSaldos, createCierre, getPeriodoActual, formatMonto,
} from '@/lib/firebase/admin'
import type { Gasto, CierreMensual, SaldoSocio, CompensacionPago } from '@/types/admin'
import { GASTO_ESTADO_LABEL, MONEDA_SYMBOL } from '@/types/admin'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, Lock, ArrowRight,
  CheckCircle, FileText, Send, TrendingDown,
} from 'lucide-react'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date()
}

export default function CierrePage() {
  const { user, profile } = useAuthContext()
  const [periodo,  setPeriodo]  = useState(getPeriodoActual())
  const [gastos,   setGastos]   = useState<Gasto[]>([])
  const [loading,  setLoading]  = useState(true)
  const [closing,  setClosing]  = useState(false)
  const [cierreId, setCierreId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
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

  useEffect(() => { loadData() }, [loadData])

  const gastosActivos = gastos.filter(g => g.estado !== 'cancelled')
  const { saldos, compensaciones } = calcularSaldos(gastosActivos)

  const totalARS = gastosActivos.filter(g => g.moneda === 'ARS').reduce((a, g) => a + g.importe, 0)
  const totalUSD = gastosActivos.filter(g => g.moneda === 'USD').reduce((a, g) => a + g.importe, 0)

  const sinComprob = gastosActivos.filter(g => !g.tieneComprobante).length
  const pendientes = gastosActivos.filter(g => g.estado === 'pending_payment').length
  const yaEnCierre = gastosActivos.filter(g => g.incluidoEnCierre).length

  const periodoLabel = (() => {
    const [y, m] = periodo.split('-').map(Number)
    return format(new Date(y, m - 1, 1), "MMMM yyyy", { locale: es })
  })()

  function changePeriodo(delta: number) {
    const [y, m] = periodo.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setPeriodo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  async function handleCierre() {
    if (!user || !profile) return
    if (!confirm(`¿Generar cierre de ${periodoLabel}? Esta acción marcará todos los gastos como incluidos en el cierre.`)) return
    setClosing(true)
    try {
      const id = await createCierre(periodo, gastosActivos, user.uid)
      setCierreId(id)
      await loadData()
    } finally {
      setClosing(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Cierre mensual"
        subtitle="Resumen, saldos y compensaciones entre socios"
        actions={
          <button onClick={handleCierre} disabled={closing || gastosActivos.length === 0}
            className="btn-primary flex items-center gap-2 text-sm">
            {closing ? <Spinner size={14} /> : <Lock size={14} />}
            Generar cierre
          </button>
        }
      />

      <div className="px-8 pb-10 space-y-6">

        {/* Selector de período */}
        <div className="flex items-center gap-3">
          <button onClick={() => changePeriodo(-1)} className="btn-ghost p-2"><ChevronLeft size={16} /></button>
          <div className="flux-card px-6 py-2 text-center min-w-[180px]">
            <p className="font-display font-bold text-flux-white capitalize">{periodoLabel}</p>
            <p className="text-2xs text-flux-text3">{periodo}</p>
          </div>
          <button onClick={() => changePeriodo(1)} className="btn-ghost p-2"><ChevronRight size={16} /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : gastosActivos.length === 0 ? (
          <div className="flux-card text-center py-16">
            <TrendingDown size={36} className="text-flux-text3 mx-auto mb-3" />
            <p className="text-flux-text2">Sin gastos en {periodoLabel}</p>
          </div>
        ) : (
          <>
            {/* Alertas previas al cierre */}
            {(sinComprob > 0 || pendientes > 0) && (
              <div className="space-y-2">
                {sinComprob > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-amber-950/30 border border-amber-800/40 rounded-xl text-sm">
                    <span className="text-amber-400 font-medium">⚠️ {sinComprob} gasto{sinComprob > 1 ? 's' : ''} sin comprobante</span>
                    <span className="text-amber-300/70 text-xs">— Se recomienda adjuntar antes del cierre</span>
                  </div>
                )}
                {pendientes > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-red-950/30 border border-red-800/40 rounded-xl text-sm">
                    <span className="text-red-400 font-medium">🔴 {pendientes} gasto{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''} de pago</span>
                  </div>
                )}
              </div>
            )}

            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flux-card text-center">
                <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">Total ARS</p>
                <p className="font-display text-xl font-bold text-flux-teal">{formatMonto(totalARS, 'ARS')}</p>
              </div>
              <div className="flux-card text-center">
                <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">Total USD</p>
                <p className="font-display text-xl font-bold text-blue-400">{formatMonto(totalUSD, 'USD')}</p>
              </div>
              <div className="flux-card text-center">
                <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">Gastos</p>
                <p className="font-display text-xl font-bold text-flux-white">{gastosActivos.length}</p>
              </div>
              <div className="flux-card text-center">
                <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-1">En cierre</p>
                <p className="font-display text-xl font-bold text-flux-white">{yaEnCierre}</p>
              </div>
            </div>

            {/* Saldos */}
            <div>
              <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">Saldos por socio</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {saldos.map(s => {
                  const color = s.saldo > 0 ? '#22D3A0' : s.saldo < 0 ? '#F43F5E' : '#9AA3C2'
                  return (
                    <div key={s.uid} className="flux-card">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium text-flux-text1">{s.nombre}</p>
                        <p className="font-bold text-sm" style={{ color }}>
                          {s.saldo === 0 ? 'Al día' : `${s.saldo > 0 ? '+' : ''}${formatMonto(Math.abs(s.saldo), 'ARS')}`}
                        </p>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-flux-text3">Pagó</span>
                          <span className="text-flux-text1">{formatMonto(s.totalPagado, 'ARS')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-flux-text3">Le corresponde</span>
                          <span className="text-flux-text1">{formatMonto(s.totalCorresponde, 'ARS')}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
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
                    <div key={i} className="flux-card flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-red-950 flex items-center justify-center text-sm font-bold text-red-400">
                          {c.deNombre.charAt(0)}
                        </div>
                        <span className="font-medium text-red-400">{c.deNombre}</span>
                      </div>
                      <ArrowRight size={16} className="text-flux-text3 shrink-0" />
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-950 flex items-center justify-center text-sm font-bold text-green-400">
                          {c.aNombre.charAt(0)}
                        </div>
                        <span className="font-medium text-green-400">{c.aNombre}</span>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="font-display font-bold text-xl text-flux-white">
                          {formatMonto(c.monto, c.moneda)}
                        </p>
                        <p className="text-2xs text-flux-text3">transferencia</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {compensaciones.length === 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-green-950/30 border border-green-800/40 rounded-xl">
                <CheckCircle size={16} className="text-flux-teal" />
                <span className="text-sm text-green-300">¡Los saldos están parejos! No hay transferencias necesarias.</span>
              </div>
            )}

            {/* Gastos del período */}
            <div>
              <h2 className="text-xs font-medium text-flux-text3 uppercase tracking-widest mb-3">
                Detalle de gastos del período
              </h2>
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
                    {gastosActivos.map(g => (
                      <tr key={g.id} className="border-b border-flux-border/50">
                        <td className="px-4 py-2.5 text-xs text-flux-text3">
                          {format(toDate(g.fecha), 'dd/MM')}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-sm text-flux-text1 font-medium">{g.proveedorNombre}</p>
                          <p className="text-2xs text-flux-text3">{g.descripcion}</p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-flux-text2">{g.categoriaNombre}</td>
                        <td className="px-4 py-2.5 font-medium text-flux-teal">
                          {MONEDA_SYMBOL[g.moneda]}{g.importe.toLocaleString('es-AR')}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-flux-text2">{g.pagadoPorNombre}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn('text-2xs px-2 py-0.5 rounded-full',
                            g.incluidoEnCierre ? 'bg-flux-tealGlow text-flux-teal' : 'bg-flux-muted text-flux-text3')}>
                            {g.incluidoEnCierre ? 'En cierre' : GASTO_ESTADO_LABEL[g.estado]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {cierreId && (
              <div className="flex items-center gap-3 px-4 py-4 bg-flux-tealGlow border border-flux-teal/30 rounded-xl">
                <CheckCircle size={18} className="text-flux-teal" />
                <div>
                  <p className="text-sm font-medium text-flux-teal">Cierre generado correctamente</p>
                  <p className="text-xs text-flux-text3">ID: {cierreId}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
