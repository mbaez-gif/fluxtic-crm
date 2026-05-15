'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './productos.module.css'
import {
  Producto, CategoriaProducto,
  CATEGORIA_PRODUCTO_LABELS, API_BASE
} from '@/types/operaciones'

const CATEGORIAS: CategoriaProducto[] = ['INSUMO', 'MARCA_PROPIA', 'REVENTA']
const initForm = {
  nombre: '', sku: '', categoria: 'INSUMO' as CategoriaProducto,
  precio_minorista: '', precio_mayorista: '',
  stock_actual: '0', stock_minimo: '5', activo: true,
}

interface ConfirmEliminar {
  producto: Producto
  forzar: boolean
}

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState(initForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const [confirm, setConfirm] = useState<ConfirmEliminar | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/productos?activo=true`)
      const data = await res.json()
      setProductos(Array.isArray(data) ? data : data.data ?? [])
    } catch { }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function abrirNuevo() { setEditando(null); setForm(initForm); setError(''); setModalOpen(true) }

  function abrirEditar(p: Producto) {
    setEditando(p)
    setForm({
      nombre: p.nombre, sku: p.sku ?? '', categoria: p.categoria,
      precio_minorista: String(p.precio_minorista),
      precio_mayorista: p.precio_mayorista ? String(p.precio_mayorista) : '',
      stock_actual: String(p.stock_actual), stock_minimo: String(p.stock_minimo),
      activo: p.activo,
    })
    setError(''); setModalOpen(true)
  }

  async function handleGuardar() {
    if (!form.nombre || !form.categoria) { setError('Nombre y categoría son obligatorios'); return }
    setSaving(true); setError('')
    try {
      const url = editando ? `${API_BASE}/productos/${editando.id}` : `${API_BASE}/productos`
      const method = editando ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre, sku: form.sku || null, categoria: form.categoria,
          precio_minorista: Number(form.precio_minorista || 0),
          precio_mayorista: form.precio_mayorista ? Number(form.precio_mayorista) : null,
          stock_actual: Number(form.stock_actual),
          stock_minimo: Number(form.stock_minimo),
          activo: form.activo,
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      const guardado: Producto = await res.json()
      setProductos(prev => editando
        ? prev.map(p => p.id === guardado.id ? guardado : p)
        : [...prev, guardado])
      setModalOpen(false)
      showToast(editando ? 'Producto actualizado' : 'Producto creado')
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function handleEliminar(forzar: boolean) {
    if (!confirm) return
    setEliminando(true)
    try {
      const res = await fetch(`${API_BASE}/productos/${confirm.producto.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forzar }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      const data = await res.json()
      if (data.tipo === 'eliminado') {
        setProductos(prev => prev.filter(p => p.id !== confirm.producto.id))
        showToast('Producto eliminado')
      } else {
        setProductos(prev => prev.map(p => p.id === confirm.producto.id ? { ...p, activo: false } : p))
        showToast('Producto desactivado (tenía movimientos de stock)')
      }
      setConfirm(null)
    } catch (e: any) { showToast(e.message) }
    finally { setEliminando(false) }
  }

  const filtrados = productos.filter(p => {
    const matchQ = !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(busqueda.toLowerCase())
    const matchCat = !filtroCat || p.categoria === filtroCat
    return matchQ && matchCat
  })

  const estadoColor = (p: Producto) => {
    if (p.stock_actual <= 0) return styles.stockCritico
    if (p.stock_actual <= p.stock_minimo) return styles.stockBajo
    return styles.stockOk
  }
  const estadoLabel = (p: Producto) => {
    if (p.stock_actual <= 0) return 'Crítico'
    if (p.stock_actual <= p.stock_minimo) return 'Bajo'
    return 'OK'
  }

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Confirm eliminar */}
      {confirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmTitle}>Eliminar producto</div>
            <div className={styles.confirmMsg}>
              ¿Eliminar <strong>{confirm.producto.nombre}</strong>?<br />
              <span style={{ fontSize: 12, color: '#8C847A', marginTop: 4, display: 'block' }}>
                Si tiene movimientos de stock registrados, será desactivado en lugar de eliminado.
              </span>
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost} onClick={() => setConfirm(null)} disabled={eliminando}>Cancelar</button>
              <button className={styles.btnDanger} onClick={() => handleEliminar(false)} disabled={eliminando}>
                {eliminando ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Productos</h1>
          <p className={styles.pageSub}>Marca propia · Insumos · Reventa</p>
        </div>
        <button className={styles.btnPrimary} onClick={abrirNuevo}>+ Nuevo producto</button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input className={styles.searchInp} placeholder="Buscar por nombre o SKU…"
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className={styles.filterSel} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIA_PRODUCTO_LABELS[c]}</option>)}
        </select>
        <button className={styles.btnGhost} style={{ fontSize: 11 }} onClick={cargar}>↻ Actualizar</button>
      </div>

      {loading ? <div className={styles.loading}>Cargando productos…</div> : (
        <div className={styles.card}>
          <div className={styles.tblWrap}>
            <table className={styles.tbl}>
              <thead>
                <tr>
                  <th>Producto</th><th>Categoría</th><th>SKU</th>
                  <th>Precio min.</th><th>Precio may.</th>
                  <th>Stock</th><th>Estado</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id} className={!p.activo ? styles.rowInactivo : ''}>
                    <td><div className={styles.prodNombre}>{p.nombre}</div></td>
                    <td><span className={`${styles.segChip} ${styles['cat-' + p.categoria.toLowerCase()]}`}>{CATEGORIA_PRODUCTO_LABELS[p.categoria]}</span></td>
                    <td className={styles.tblMuted}>{p.sku || '—'}</td>
                    <td>{p.precio_minorista > 0 ? `$${p.precio_minorista.toLocaleString('es-AR')}` : '—'}</td>
                    <td className={styles.tblMuted}>{p.precio_mayorista ? `$${p.precio_mayorista.toLocaleString('es-AR')}` : '—'}</td>
                    <td><strong className={estadoColor(p)}>{p.stock_actual}</strong> <span className={styles.tblMuted}>/ {p.stock_minimo} mín</span></td>
                    <td><span className={`${styles.statusBadge} ${estadoColor(p)}`}>{estadoLabel(p)}</span></td>
                    <td>
                      <div className={styles.tblActions}>
                        <button className={styles.actBtn} onClick={() => abrirEditar(p)}>✏️</button>
                        <button className={styles.actBtn} onClick={() => setConfirm({ producto: p, forzar: false })} title="Eliminar">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={8} className={styles.emptyRow}>Sin productos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal crear/editar */}
      {modalOpen && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {error && <div className={styles.errorBanner}>{error}</div>}
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.full}`}>
                  <label className={styles.formLabel}>Nombre *</label>
                  <input className={styles.formInp} value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del producto…" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>SKU</label>
                  <input className={styles.formInp} value={form.sku}
                    onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU-001" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Categoría *</label>
                  <select className={styles.formSel} value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaProducto }))}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{CATEGORIA_PRODUCTO_LABELS[c]}</option>)}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Precio minorista</label>
                  <input className={styles.formInp} type="number" value={form.precio_minorista}
                    onChange={e => setForm(f => ({ ...f, precio_minorista: e.target.value }))} placeholder="0" />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Precio mayorista</label>
                  <input className={styles.formInp} type="number" value={form.precio_mayorista}
                    onChange={e => setForm(f => ({ ...f, precio_mayorista: e.target.value }))} placeholder="0" />
                </div>
                {!editando && (
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Stock inicial</label>
                    <input className={styles.formInp} type="number" value={form.stock_actual}
                      onChange={e => setForm(f => ({ ...f, stock_actual: e.target.value }))} placeholder="0" />
                  </div>
                )}
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Stock mínimo</label>
                  <input className={styles.formInp} type="number" value={form.stock_minimo}
                    onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} placeholder="5" />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleGuardar} disabled={saving}>
                {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
