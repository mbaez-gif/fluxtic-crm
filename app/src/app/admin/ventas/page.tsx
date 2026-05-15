'use client'

import { useEffect, useState, useCallback } from 'react'
import s from './ventas.module.css'
import { usePermisos } from '@/hooks/usePermisos'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'

interface ItemVenta {
  id: string
  tipo: 'SERVICIO' | 'PRODUCTO'
  nombre: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
}

interface Venta {
  id: string
  numero_comprobante?: number
  estado: string
  origen: string
  medio_pago: string
  subtotal: number
  descuento: number
  descuento_pct: number
  sena_aplicada?: number
  total: number
  notas?: string
  pdf_url?: string
  createdAt: string
  cliente?: { id: string; nombre: string; apellido: string; telefono?: string }
  profesional?: { id: string; nombre: string; apellido: string }
  items: ItemVenta[]
}

const MEDIOS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  DEBITO: 'Débito',
  CREDITO: 'Crédito',
  MERCADOPAGO: 'MercadoPago',
}

const ORIGENES: Record<string, string> = {
  LOCAL: 'Local',
  TURNO: 'Turno',
  TIENDANUBE: 'Tiendanube',
  WHATSAPP: 'WhatsApp',
  LINK_PUBLICO: 'Link público',
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function estadoChip(estado: string) {
  const map: Record<string, string> = {
    PAGADA: s.chipPagada,
    ANULADA: s.chipAnulada,
    BORRADOR: s.chipBorrador,
    PAGO_PARCIAL: s.chipParcial,
    DEVUELTA: s.chipDevuelta,
  }
  const labels: Record<string, string> = {
    PAGADA: 'Pagada', ANULADA: 'Anulada', BORRADOR: 'Borrador',
    PAGO_PARCIAL: 'Parcial', DEVUELTA: 'Devuelta',
  }
  return <span className={`${s.chip} ${map[estado] ?? s.chipBorrador}`}>{labels[estado] ?? estado}</span>
}

export default function VentasPage() {
  const permisos = usePermisos()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Venta | null>(null)
  const [anularModal, setAnularModal] = useState(false)
  const [anularMotivo, setAnularMotivo] = useState('')
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  // Filters
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState('')
  const [medioPago, setMedioPago] = useState('')
  const [origen, setOrigen] = useState('')

  const LIMIT = 30

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchVentas = useCallback(async (pg = page) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(pg), limit: String(LIMIT) })
    if (desde)     params.set('desde', desde)
    if (hasta)     params.set('hasta', hasta)
    if (estado)    params.set('estado', estado)
    if (medioPago) params.set('medio_pago', medioPago)
    if (origen)    params.set('origen', origen)

    try {
      const res  = await fetch(`${API}/ventas?${params}`)
      const json = await res.json()
      setVentas(json.data ?? [])
      setTotal(json.total ?? 0)
    } catch {
      showToast('Error al cargar ventas', false)
    } finally {
      setLoading(false)
    }
  }, [page, desde, hasta, estado, medioPago, origen])

  useEffect(() => { fetchVentas(page) }, [page])

  const aplicarFiltros = () => { setPage(1); fetchVentas(1) }
  const limpiarFiltros = () => {
    setDesde(''); setHasta(''); setEstado(''); setMedioPago(''); setOrigen('')
    setPage(1); setTimeout(() => fetchVentas(1), 0)
  }

  const anularVenta = async () => {
    if (!selected) return
    setProcessing(true)
    try {
      const res = await fetch(`${API}/ventas/${selected.id}/anular`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo: anularMotivo }),
      })
      if (!res.ok) throw new Error()
      setVentas(prev => prev.map(v => v.id === selected.id ? { ...v, estado: 'ANULADA' } : v))
      setSelected(prev => prev ? { ...prev, estado: 'ANULADA' } : null)
      setAnularModal(false)
      setAnularMotivo('')
      showToast('Venta anulada')
    } catch {
      showToast('Error al anular la venta', false)
    } finally {
      setProcessing(false)
    }
  }

  const generarPDF = async () => {
    if (!selected) return
    setProcessing(true)
    try {
      const res = await fetch(`${API}/pdf/venta/${selected.id}`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      const numComp  = selected.numero_comprobante
      a.href         = url
      a.download     = `comprobante-${numComp ? String(numComp).padStart(6, '0') : selected.id.slice(-6)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Comprobante descargado')
    } catch {
      showToast('Error al generar PDF', false)
    } finally {
      setProcessing(false)
    }
  }

  // KPI summary
  const totalImporte = ventas.filter(v => v.estado === 'PAGADA' || v.estado === 'PAGO_PARCIAL').reduce((s, v) => s + v.total, 0)
  const cantPagadas  = ventas.filter(v => v.estado === 'PAGADA' || v.estado === 'PAGO_PARCIAL').length
  const cantAnuladas = ventas.filter(v => v.estado === 'ANULADA').length
  const ticketProm   = cantPagadas ? totalImporte / cantPagadas : 0

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header}>
        <div>
          <div className={s.title}>Ventas</div>
          <div className={s.sub}>Historial · {total} registros</div>
        </div>
      </div>

      {/* KPIs */}
      <div className={s.kpiRow}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Total (página)</div>
          <div className={s.kpiVal}>{formatMoney(totalImporte)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Ventas pagadas</div>
          <div className={s.kpiVal}>{cantPagadas}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Ticket promedio</div>
          <div className={s.kpiVal}>{formatMoney(ticketProm)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Anuladas</div>
          <div className={s.kpiVal}>{cantAnuladas}</div>
        </div>
      </div>

      {/* Filters */}
      <div className={s.filtersBar}>
        <input
          type="date"
          className={s.filterInput}
          value={desde}
          onChange={e => setDesde(e.target.value)}
          placeholder="Desde"
          title="Desde"
        />
        <input
          type="date"
          className={s.filterInput}
          value={hasta}
          onChange={e => setHasta(e.target.value)}
          placeholder="Hasta"
          title="Hasta"
        />
        <select className={s.filterSelect} value={estado} onChange={e => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="PAGADA">Pagada</option>
          <option value="PAGO_PARCIAL">Pago parcial</option>
          <option value="ANULADA">Anulada</option>
          <option value="BORRADOR">Borrador</option>
        </select>
        <select className={s.filterSelect} value={medioPago} onChange={e => setMedioPago(e.target.value)}>
          <option value="">Todos los medios</option>
          <option value="EFECTIVO">Efectivo</option>
          <option value="TRANSFERENCIA">Transferencia</option>
          <option value="DEBITO">Débito</option>
          <option value="CREDITO">Crédito</option>
          <option value="MERCADOPAGO">MercadoPago</option>
        </select>
        <select className={s.filterSelect} value={origen} onChange={e => setOrigen(e.target.value)}>
          <option value="">Todos los orígenes</option>
          <option value="LOCAL">Local</option>
          <option value="TIENDANUBE">Tiendanube</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="LINK_PUBLICO">Link público</option>
        </select>
        <button className={`${s.filterBtn} ${s.filterBtnActive}`} onClick={aplicarFiltros}>Buscar</button>
        <button className={s.filterBtn} onClick={limpiarFiltros}>Limpiar</button>
      </div>

      {/* Layout */}
      <div className={`${s.layout} ${!selected ? s.layoutFull : ''}`}>
        {/* Table */}
        <div className={s.tableCard}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Origen</th>
                <th>Medio</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}><div className={s.skeleton} style={{ height: 12, width: j === 6 ? 60 : '80%' }} /></td>
                    ))}
                  </tr>
                ))
              ) : ventas.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={s.empty}>No hay ventas para los filtros aplicados</div>
                  </td>
                </tr>
              ) : (
                ventas.map(v => (
                  <tr
                    key={v.id}
                    className={selected?.id === v.id ? s.rowSelected : ''}
                    onClick={() => setSelected(selected?.id === v.id ? null : v)}
                  >
                    <td className={s.numComp}>
                      {v.numero_comprobante ? `#${String(v.numero_comprobante).padStart(6, '0')}` : '—'}
                    </td>
                    <td>{formatFecha(v.createdAt)} <span style={{ color: 'var(--muted)', fontSize: 11 }}>{formatHora(v.createdAt)}</span></td>
                    <td className={s.clienteCell}>
                      {v.cliente ? `${v.cliente.nombre} ${v.cliente.apellido}` : <span style={{ color: 'var(--muted)' }}>Sin cliente</span>}
                    </td>
                    <td><span className={s.medioChip}>{ORIGENES[v.origen] ?? v.origen}</span></td>
                    <td><span className={s.medioChip}>{MEDIOS[v.medio_pago] ?? v.medio_pago}</span></td>
                    <td>{estadoChip(v.estado)}</td>
                    <td className={s.importeCell}>{formatMoney(v.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className={s.pagination}>
              <span className={s.paginationInfo}>
                {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de {total}
              </span>
              <div className={s.paginationBtns}>
                <button className={s.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg = i + 1
                  if (totalPages > 5) {
                    if (page <= 3) pg = i + 1
                    else if (page >= totalPages - 2) pg = totalPages - 4 + i
                    else pg = page - 2 + i
                  }
                  return (
                    <button
                      key={pg}
                      className={`${s.pageBtn} ${pg === page ? s.pageBtnActive : ''}`}
                      onClick={() => setPage(pg)}
                    >
                      {pg}
                    </button>
                  )
                })}
                <button className={s.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className={s.detailPanel}>
            <div className={s.detailHead}>
              <span className={s.detailTitle}>
                {selected.numero_comprobante
                  ? `Comprobante #${String(selected.numero_comprobante).padStart(6, '0')}`
                  : 'Detalle de venta'}
              </span>
              <button className={s.detailClose} onClick={() => setSelected(null)}>×</button>
            </div>

            <div className={s.detailBody}>
              {/* Info general */}
              <div className={s.detailSection}>
                <div className={s.detailSectionTitle}>General</div>
                <div className={s.detailRow}>
                  <span className={s.detailLabel}>Fecha</span>
                  <span className={s.detailVal}>{formatFecha(selected.createdAt)} {formatHora(selected.createdAt)}</span>
                </div>
                <div className={s.detailRow}>
                  <span className={s.detailLabel}>Estado</span>
                  <span className={s.detailVal}>{estadoChip(selected.estado)}</span>
                </div>
                <div className={s.detailRow}>
                  <span className={s.detailLabel}>Origen</span>
                  <span className={s.detailVal}>{ORIGENES[selected.origen] ?? selected.origen}</span>
                </div>
                <div className={s.detailRow}>
                  <span className={s.detailLabel}>Medio de pago</span>
                  <span className={s.detailVal}>{MEDIOS[selected.medio_pago] ?? selected.medio_pago}</span>
                </div>
              </div>

              <div className={s.detailDivider} />

              {/* Cliente / Profesional */}
              <div className={s.detailSection}>
                <div className={s.detailSectionTitle}>Cliente</div>
                <div className={s.detailRow}>
                  <span className={s.detailLabel}>Nombre</span>
                  <span className={s.detailVal}>
                    {selected.cliente ? `${selected.cliente.nombre} ${selected.cliente.apellido}` : '—'}
                  </span>
                </div>
                {selected.cliente?.telefono && (
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Teléfono</span>
                    <span className={s.detailVal}>{selected.cliente.telefono}</span>
                  </div>
                )}
                {selected.profesional && (
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Profesional</span>
                    <span className={s.detailVal}>{selected.profesional.nombre} {selected.profesional.apellido}</span>
                  </div>
                )}
              </div>

              <div className={s.detailDivider} />

              {/* Items */}
              <div className={s.detailSection}>
                <div className={s.detailSectionTitle}>Ítems</div>
                <table className={s.itemsTable}>
                  <thead>
                    <tr>
                      <th>Detalle</th>
                      <th>Cant.</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map(item => (
                      <tr key={item.id}>
                        <td>
                          {item.nombre}
                          <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 4 }}>
                            {formatMoney(item.precio_unitario)} c/u
                          </span>
                        </td>
                        <td>{item.cantidad}</td>
                        <td>{formatMoney(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={s.detailDivider} />

              {/* Totales */}
              <div className={s.detailSection}>
                <div className={s.detailRow}>
                  <span className={s.detailLabel}>Subtotal</span>
                  <span className={s.detailVal}>{formatMoney(selected.subtotal)}</span>
                </div>
                {selected.descuento > 0 && (
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Descuento{selected.descuento_pct > 0 ? ` (${selected.descuento_pct}%)` : ''}</span>
                    <span className={s.detailVal} style={{ color: 'var(--error)' }}>−{formatMoney(selected.descuento)}</span>
                  </div>
                )}
                {selected.sena_aplicada && selected.sena_aplicada > 0 && (
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Seña aplicada</span>
                    <span className={s.detailVal} style={{ color: '#6B4E9E' }}>−{formatMoney(selected.sena_aplicada)}</span>
                  </div>
                )}
                <div className={s.totalRow}>
                  <span>Total</span>
                  <span>{formatMoney(selected.total)}</span>
                </div>
              </div>

              {selected.notas && (
                <>
                  <div className={s.detailDivider} />
                  <div className={s.detailSection}>
                    <div className={s.detailSectionTitle}>Notas</div>
                    <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: 0 }}>{selected.notas}</p>
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className={s.detailActions}>
              <button className={s.detailBtn} onClick={generarPDF} disabled={processing}>
                {processing ? 'Generando…' : 'Descargar comprobante PDF'}
              </button>
              {selected.estado !== 'ANULADA' && permisos.puede_anular_ventas && (
                <button className={`${s.detailBtn} ${s.detailBtnDanger}`} onClick={() => setAnularModal(true)}>
                  Anular venta
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Anular modal */}
      {anularModal && selected && (
        <div className={s.overlay} onClick={() => setAnularModal(false)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalHead}>
              <span className={s.modalTitle}>Anular venta</span>
              <button className={s.modalClose} onClick={() => setAnularModal(false)}>×</button>
            </div>
            <div className={s.modalBody}>
              <p className={s.modalDesc}>
                ¿Seguro que querés anular la venta{selected.numero_comprobante ? ` #${String(selected.numero_comprobante).padStart(6, '0')}` : ''}?
                El stock de productos será repuesto automáticamente.
              </p>
              <textarea
                className={s.modalTextarea}
                placeholder="Motivo de anulación (opcional)"
                value={anularMotivo}
                onChange={e => setAnularMotivo(e.target.value)}
              />
            </div>
            <div className={s.modalActions}>
              <button className={s.modalBtn} onClick={() => setAnularModal(false)}>Cancelar</button>
              <button className={`${s.modalBtn} ${s.modalBtnDanger}`} onClick={anularVenta} disabled={processing}>
                {processing ? 'Anulando…' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`${s.toast} ${toast.ok ? s.toastOk : s.toastErr}`}>{toast.msg}</div>
      )}
    </div>
  )
}
