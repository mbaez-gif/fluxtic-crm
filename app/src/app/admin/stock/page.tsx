'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './stock.module.css'
import { Producto, API_BASE, CATEGORIA_PRODUCTO_LABELS, CategoriaProducto } from '@/types/operaciones'

type TipoMovimiento = 'ENTRADA' | 'AJUSTE_MANUAL' | 'USO_SERVICIO'

interface MovimientoForm {
  producto_id: string
  tipo: TipoMovimiento
  cantidad: string
  notas: string
}

export default function StockPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null)
  const [form, setForm] = useState<MovimientoForm>({ producto_id: '', tipo: 'ENTRADA', cantidad: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroCritico, setFiltroCritico] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/stock`)
      const data = await res.json()
      const lista: Producto[] = Array.isArray(data) ? data : data.data ?? []
      setProductos(lista)
    } catch { setError('Error al cargar stock') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function abrirAjuste(p: Producto) {
    setProductoSeleccionado(p)
    setForm({ producto_id: p.id, tipo: 'ENTRADA', cantidad: '', notas: '' })
    setError(''); setModalOpen(true)
  }

  async function handleMovimiento() {
    if (!form.cantidad || Number(form.cantidad) === 0) { setError('Ingresá una cantidad distinta de 0'); return }
    setSaving(true); setError('')
    try {
      const esEgreso = form.tipo === 'USO_SERVICIO'
      const cantidad = esEgreso ? -Math.abs(Number(form.cantidad)) : Math.abs(Number(form.cantidad))

      const res = await fetch(`${API_BASE}/stock/movimiento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto_id: form.producto_id,
          tipo: form.tipo,
          cantidad,
          notas: form.notas || null,
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      setModalOpen(false)
      await cargar()
      showToast('Movimiento registrado')
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const estadoProducto = (p: Producto) => {
    if (p.stock_actual <= 0) return 'CRITICO'
    if (p.stock_actual <= p.stock_minimo) return 'BAJO'
    return 'OK'
  }

  const filtrados = productos.filter(p => {
    const matchQ = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const matchCrit = !filtroCritico || estadoProducto(p) !== 'OK'
    return matchQ && matchCrit
  })

  const criticos = productos.filter(p => estadoProducto(p) === 'CRITICO').length
  const bajos = productos.filter(p => estadoProducto(p) === 'BAJO').length
  const valorTotal = productos.reduce((acc, p) => acc + (p.stock_actual * p.precio_minorista), 0)

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Stock</h1>
          <p className={styles.pageSub}>Inventario centralizado · Alertas automáticas</p>
        </div>
      </div>

      {/* KPIs */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Total productos</div>
          <div className={styles.kpiVal}>{productos.length}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Stock crítico</div>
          <div className={`${styles.kpiVal} ${criticos > 0 ? styles.kpiRed : ''}`}>{criticos}</div>
          {criticos > 0 && <div className={styles.kpiDelta}>↓ Por debajo del mínimo</div>}
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Stock bajo</div>
          <div className={`${styles.kpiVal} ${bajos > 0 ? styles.kpiGold : ''}`}>{bajos}</div>
        </div>
        <div className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Valor inventario</div>
          <div className={styles.kpiVal}>${(valorTotal / 1000).toFixed(0)}K</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input className={styles.searchInp} placeholder="Buscar producto o SKU…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <button
          className={filtroCritico ? styles.btnPrimary : styles.btnGhost}
          style={{ fontSize: 11 }}
          onClick={() => setFiltroCritico(v => !v)}
        >
          ⚠️ Solo críticos
        </button>
        <button className={styles.btnGhost} style={{ fontSize: 11 }} onClick={cargar}>↻ Actualizar</button>
      </div>

      {loading ? <div className={styles.loading}>Cargando inventario…</div> : (
        <div className={styles.card}>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Producto</th><th>Categoría</th><th>Stock actual</th>
                  <th>Mínimo</th><th>Nivel</th><th>Estado</th>
                  <th>Precio min.</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const est = estadoProducto(p)
                  const pct = Math.min(100, Math.round((p.stock_actual / Math.max(p.stock_minimo * 2, 1)) * 100))
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className={styles.prodNombre}>{p.nombre}</div>
                        {p.sku && <div className={styles.prodSku}>{p.sku}</div>}
                      </td>
                      <td><span className={`${styles.segChip} ${styles['cat-' + p.categoria.toLowerCase()]}`}>{CATEGORIA_PRODUCTO_LABELS[p.categoria as CategoriaProducto]}</span></td>
                      <td><strong className={est === 'CRITICO' ? styles.red : est === 'BAJO' ? styles.gold : styles.green}>{p.stock_actual}</strong></td>
                      <td className={styles.tblMuted}>{p.stock_minimo}</td>
                      <td>
                        <div className={styles.barWrap}>
                          <div className={styles.bar} style={{
                            width: `${pct}%`,
                            background: est === 'CRITICO' ? '#D4957A' : est === 'BAJO' ? '#B89860' : '#8BA888'
                          }} />
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${est === 'CRITICO' ? styles.sCritico : est === 'BAJO' ? styles.sBajo : styles.sOk}`}>
                          {est === 'CRITICO' ? 'Crítico' : est === 'BAJO' ? 'Bajo' : 'OK'}
                        </span>
                      </td>
                      <td className={styles.tblMuted}>
                        {p.precio_minorista > 0 ? `$${p.precio_minorista.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td>
                        <button className={styles.adjBtn} onClick={() => abrirAjuste(p)}>Ajustar</button>
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className={styles.emptyRow}>Sin productos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal ajuste */}
      {modalOpen && productoSeleccionado && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>Ajuste de stock</h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {error && <div className={styles.errorBanner}>{error}</div>}

              <div className={styles.prodInfo}>
                <div className={styles.prodInfoNombre}>{productoSeleccionado.nombre}</div>
                <div className={styles.prodInfoStock}>
                  Stock actual: <strong>{productoSeleccionado.stock_actual}</strong> · Mínimo: {productoSeleccionado.stock_minimo}
                </div>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Tipo de movimiento *</label>
                  <select className={styles.formSel} value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoMovimiento }))}>
                    <option value="ENTRADA">Entrada (compra / recepción)</option>
                    <option value="AJUSTE_MANUAL">Ajuste manual</option>
                    <option value="USO_SERVICIO">Uso en servicio (descuenta)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Cantidad *</label>
                  <input className={styles.formInp} type="number" value={form.cantidad}
                    onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))}
                    placeholder={form.tipo === 'USO_SERVICIO' ? 'Cantidad a descontar' : 'Cantidad a agregar'} />
                </div>
                <div className={`${styles.formGroup} ${styles.full}`}>
                  <label className={styles.formLabel}>Notas</label>
                  <input className={styles.formInp} value={form.notas}
                    onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                    placeholder="Motivo del ajuste…" />
                </div>
              </div>

              {form.cantidad && Number(form.cantidad) !== 0 && (
                <div className={styles.preview}>
                  Stock resultante: <strong>
                    {form.tipo === 'USO_SERVICIO'
                      ? productoSeleccionado.stock_actual - Math.abs(Number(form.cantidad))
                      : productoSeleccionado.stock_actual + Math.abs(Number(form.cantidad))
                    }
                  </strong>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleMovimiento} disabled={saving}>
                {saving ? 'Registrando…' : 'Registrar movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
