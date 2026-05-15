'use client'

import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './caja.module.css'
import {
  Servicio, Producto, ItemCarrito, MedioPago,
  MEDIO_PAGO_LABELS, API_BASE
} from '@/types/operaciones'
import { usePermisos } from '@/hooks/usePermisos'

interface ClienteBusqueda {
  id: string
  nombre: string
  apellido: string
  telefono?: string | null
  segmento: string
}

interface Profesional {
  id: string
  nombre: string
  apellido: string
}

function CajaContent() {
  const searchParams = useSearchParams()
  const turnoIdParam = searchParams.get('turnoId')
  const permisos = usePermisos()

  const [servicios, setServicios] = useState<Servicio[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [profesionales, setProfesionales] = useState<Profesional[]>([])
  const [carrito, setCarrito] = useState<ItemCarrito[]>([])
  const [clienteQuery, setClienteQuery] = useState('')
  const [clienteResultados, setClienteResultados] = useState<ClienteBusqueda[]>([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteBusqueda | null>(null)
  const [profesionalId, setProfesionalId] = useState('')
  const [medioPago, setMedioPago] = useState<MedioPago>('EFECTIVO')
  const [descuento, setDescuento] = useState('0')
  const [notas, setNotas] = useState('')
  const [senaAplicada, setSenaAplicada] = useState('0')
  const [turnoId, setTurnoId] = useState<string | null>(null)
  const [turnoInfo, setTurnoInfo] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'servicios' | 'productos'>('servicios')
  const [busquedaItems, setBusquedaItems] = useState('')
  const [ventaExitosa, setVentaExitosa] = useState<{ id: string; total: number; numComp?: number } | null>(null)
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const clienteInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pendientes, setPendientes] = useState<any[]>([])
  const [loadingPendientes, setLoadingPendientes] = useState(false)
  const [turnoYaFacturado, setTurnoYaFacturado] = useState<{ ventaId: string; numComp?: number } | null>(null)

  const cargarDatos = useCallback(async () => {
    try {
      const [sRes, pRes, prRes] = await Promise.all([
        fetch(`${API_BASE}/servicios`),
        fetch(`${API_BASE}/productos`),
        fetch(`${API_BASE}/profesionales`),
      ])
      const sData = await sRes.json()
      const pData = await pRes.json()
      const prData = await prRes.json()
      setServicios(Array.isArray(sData) ? sData : sData.data ?? [])
      setProductos((Array.isArray(pData) ? pData : pData.data ?? []).filter((p: Producto) => p.activo && p.stock_actual > 0))
      setProfesionales(Array.isArray(prData) ? prData : prData.data ?? [])
    } catch {}
  }, [])

  const cargarPendientes = useCallback(async () => {
    setLoadingPendientes(true)
    try {
      const res = await fetch(`${API_BASE}/turnos?estado=PENDIENTE_FACTURAR&limit=50`)
      const data = await res.json()
      setPendientes(data.data ?? [])
    } catch {} finally { setLoadingPendientes(false) }
  }, [])

  useEffect(() => { cargarDatos(); cargarPendientes() }, [cargarDatos, cargarPendientes])

  // Auto-cargar turno si viene con turnoId
  useEffect(() => {
    if (!turnoIdParam) return
    async function cargarTurno() {
      try {
        const res = await fetch(`${API_BASE}/turnos/${turnoIdParam}`)
        if (!res.ok) return
        const raw = await res.json()
        const t = raw.data ?? raw
        setTurnoId(t.id)

        if (t.cliente) {
          setClienteSeleccionado({
            id: t.cliente.id,
            nombre: t.cliente.nombre,
            apellido: t.cliente.apellido ?? '',
            telefono: t.cliente.telefono,
            segmento: 'VIP',
          })
        }

        if (t.profesional?.id) setProfesionalId(t.profesional.id)

        if (t.servicio) {
          const precio = t.precio ?? t.servicio.precio ?? 0
          setCarrito([{
            tipo: 'SERVICIO',
            id: t.servicio.id,
            nombre: t.servicio.nombre,
            cantidad: 1,
            precio_unitario: Number(precio),
          }])
        }

        if (t.sena_pagada && t.senia && Number(t.senia) > 0) {
          setSenaAplicada(String(Number(t.senia)))
        }

        setTurnoInfo(
          `Turno: ${t.cliente ? `${t.cliente.nombre} ${t.cliente.apellido ?? ''}` : '—'} · ${t.fecha} ${t.hora_inicio?.slice(0, 5) ?? ''}`
        )
      } catch {}
    }
    cargarTurno()
  }, [turnoIdParam]) // eslint-disable-line

  // Búsqueda clientes con debounce
  useEffect(() => {
    if (!clienteQuery || clienteQuery.length < 2) {
      setClienteResultados([])
      setShowDropdown(false)
      return
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/clientes?q=${encodeURIComponent(clienteQuery)}&limit=5`)
        const data = await res.json()
        const lista = Array.isArray(data) ? data : data.data ?? []
        setClienteResultados(lista)
        setShowDropdown(lista.length > 0)
      } catch {
        setClienteResultados([])
        setShowDropdown(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [clienteQuery])

  // Cerrar dropdown al hacer clic afuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        clienteInputRef.current && !clienteInputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  function agregarItem(tipo: 'SERVICIO' | 'PRODUCTO', item: Servicio | Producto) {
    setCarrito(prev => {
      const existente = prev.find(i => i.id === item.id && i.tipo === tipo)
      if (existente) {
        return prev.map(i => i.id === item.id && i.tipo === tipo
          ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, {
        tipo, id: item.id, nombre: item.nombre, cantidad: 1,
        precio_unitario: tipo === 'SERVICIO' ? (item as Servicio).precio : (item as Producto).precio_minorista,
      }]
    })
  }

  function quitarItem(id: string, tipo: string) {
    setCarrito(prev => prev.filter(i => !(i.id === id && i.tipo === tipo)))
  }

  function cambiarCantidad(id: string, tipo: string, delta: number) {
    setCarrito(prev => prev.map(i => {
      if (i.id === id && i.tipo === tipo) {
        const nueva = i.cantidad + delta
        if (nueva <= 0) return null as any
        return { ...i, cantidad: nueva }
      }
      return i
    }).filter(Boolean))
  }

  const subtotal   = carrito.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0)
  const descPct    = Number(descuento) || 0
  const descMonto  = subtotal * descPct / 100
  const sena       = Math.max(0, Number(senaAplicada) || 0)
  const total      = Math.max(0, subtotal - descMonto - sena)

  async function handleVenta() {
    if (carrito.length === 0) { setError('Agregá al menos un item al carrito'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        cliente_id:     clienteSeleccionado?.id ?? null,
        profesional_id: profesionalId || null,
        turno_id:       turnoId ?? null,
        origen:         turnoId ? 'TURNO' : 'LOCAL',
        items: carrito.map(i => ({
          tipo: i.tipo, id: i.id, nombre: i.nombre,
          cantidad: i.cantidad, precio_unitario: i.precio_unitario,
        })),
        medio_pago:     medioPago,
        descuento_pct:  descPct,
        sena_aplicada:  sena > 0 ? sena : undefined,
        notas:          notas || null,
      }

      const res = await fetch(`${API_BASE}/ventas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.status === 409) {
        const d = await res.json()
        setTurnoYaFacturado({ ventaId: d.venta_id, numComp: d.numero_comprobante })
        return
      }

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || `Error ${res.status}`)
      }

      const venta = await res.json()
      setVentaExitosa({ id: venta.id, total: Number(venta.total), numComp: venta.numero_comprobante })
      limpiar()
      descargarPdf(venta.id, venta.numero_comprobante)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function descargarPdf(ventaId: string, numComp?: number) {
    setDescargandoPdf(true)
    try {
      const res = await fetch(`${API_BASE}/pdf/venta/${ventaId}`, { method: 'POST' })
      if (!res.ok) return
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `comprobante-${numComp ? String(numComp).padStart(6, '0') : ventaId.slice(-6)}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      // falla silenciosamente — se puede reintentar desde el panel de ventas
    } finally {
      setDescargandoPdf(false)
    }
  }

  function limpiar() {
    setCarrito([]); setClienteQuery(''); setClienteSeleccionado(null)
    setClienteResultados([]); setShowDropdown(false)
    setDescuento('0'); setSenaAplicada('0'); setNotas(''); setProfesionalId(''); setMedioPago('EFECTIVO')
    setTurnoId(null); setTurnoInfo(null)
  }

  const itemsFiltrados = tab === 'servicios'
    ? servicios.filter(s => s.activo && (!busquedaItems || s.nombre.toLowerCase().includes(busquedaItems.toLowerCase())))
    : productos.filter(p => !busquedaItems || p.nombre.toLowerCase().includes(busquedaItems.toLowerCase()))

  const MEDIOS: MedioPago[] = ['EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'CREDITO', 'MERCADOPAGO']

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {ventaExitosa && (
        <div className={styles.successOverlay} onClick={() => setVentaExitosa(null)}>
          <div className={styles.successBox} onClick={e => e.stopPropagation()}>
            <div className={styles.successIcon}>✅</div>
            <div className={styles.successTitle}>¡Venta registrada!</div>
            <div className={styles.successTotal}>${ventaExitosa.total.toLocaleString('es-AR')}</div>
            <div className={styles.successId}>
              {ventaExitosa.numComp
                ? `#${String(ventaExitosa.numComp).padStart(6, '0')}`
                : `#${ventaExitosa.id.slice(-6).toUpperCase()}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
              {descargandoPdf ? '⏳ Generando comprobante…' : '📄 Comprobante descargado'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                className={styles.btnPrimary}
                onClick={() => descargarPdf(ventaExitosa.id, ventaExitosa.numComp)}
                disabled={descargandoPdf}
                style={{ flex: 1 }}
              >
                Reimprimir PDF
              </button>
              <button className={styles.btnPrimary} onClick={() => setVentaExitosa(null)} style={{ flex: 1 }}>
                Nueva venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel de turnos pendientes de facturar */}
      {!turnoId && pendientes.length > 0 && (
        <div style={{ background: '#FFFBF5', border: '1px solid #E4D5B8', borderRadius: 10, padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#7A5C10', marginBottom: 10 }}>
            ⏳ Servicios pendientes de facturar ({pendientes.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pendientes.map((t: any) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 7, padding: '8px 12px', border: '1px solid #EDE5D5' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: '#1C1814' }}>
                    {t.cliente ? `${t.cliente.nombre} ${t.cliente.apellido ?? ''}` : '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#8C847A' }}>
                    {t.servicio?.nombre ?? '—'} · {t.profesional?.nombre ?? '—'} · {t.hora_inicio?.slice(0, 5)}
                    {t.sena_pagada && <span style={{ color: '#2D6A4F', marginLeft: 6 }}>· Seña ✓</span>}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1C1814', whiteSpace: 'nowrap' }}>
                  ${Number(t.precio ?? 0).toLocaleString('es-AR')}
                </div>
                <button
                  onClick={() => {
                    window.history.replaceState(null, '', `/admin/caja?turnoId=${t.id}`)
                    window.location.reload()
                  }}
                  style={{ background: '#2D6A4F', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  💰 Facturar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Caja · POS</h1>
          <p className={styles.pageSub}>{turnoInfo ?? 'Registro de ventas en el local'}</p>
        </div>
        {turnoInfo && (
          <div style={{ background: 'var(--blush)', border: '1px solid var(--blush-d)', borderRadius: 8, padding: '6px 14px', fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📅</span>
            <span>Cargado desde turno</span>
          </div>
        )}
      </div>

      <div className={styles.layout}>
        {/* Panel izquierdo */}
        <div className={styles.leftPanel}>
          {/* Cliente */}
          <div className={styles.card}>
            <div className={styles.cardHead}><span className={styles.cardTitle}>Cliente</span></div>
            <div className={styles.cardBody}>
              {clienteSeleccionado ? (
                <div className={styles.clienteSeleccionado}>
                  <div className={styles.clienteAv}>{clienteSeleccionado.nombre[0]}</div>
                  <div>
                    <div className={styles.clienteNombre}>{clienteSeleccionado.nombre} {clienteSeleccionado.apellido}</div>
                    <div className={styles.clienteTel}>{clienteSeleccionado.telefono || clienteSeleccionado.segmento}</div>
                  </div>
                  <button className={styles.clearBtn} onClick={() => { setClienteSeleccionado(null); setClienteQuery('') }}>✕</button>
                </div>
              ) : (
                <div className={styles.clienteBusqueda}>
                  <input
                    ref={clienteInputRef}
                    className={styles.searchInp}
                    placeholder="Buscar cliente por nombre o teléfono…"
                    value={clienteQuery}
                    onChange={e => { setClienteQuery(e.target.value); setShowDropdown(true) }}
                    onFocus={() => clienteResultados.length > 0 && setShowDropdown(true)}
                    autoComplete="off"
                  />
                  {showDropdown && clienteResultados.length > 0 && (
                    <div className={styles.dropdown} ref={dropdownRef}>
                      {clienteResultados.map(c => (
                        <div
                          key={c.id}
                          className={styles.dropItem}
                          onMouseDown={e => {
                            e.preventDefault()
                            setClienteSeleccionado(c)
                            setClienteQuery('')
                            setClienteResultados([])
                            setShowDropdown(false)
                          }}
                        >
                          <div className={styles.dropAv}>{c.nombre[0]}</div>
                          <div>
                            <strong className={styles.dropNombre}>{c.nombre} {c.apellido}</strong>
                            <div className={styles.dropTel}>{c.telefono || c.segmento}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Catálogo */}
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div className={styles.tabs}>
                <button className={tab === 'servicios' ? styles.tabActive : styles.tab} onClick={() => setTab('servicios')}>Servicios</button>
                <button className={tab === 'productos' ? styles.tabActive : styles.tab} onClick={() => setTab('productos')}>Productos</button>
              </div>
            </div>
            <div className={styles.cardBody}>
              <input className={styles.searchInp} placeholder="Buscar…"
                value={busquedaItems} onChange={e => setBusquedaItems(e.target.value)}
                style={{ marginBottom: 12 }} />
              <div className={styles.itemsGrid}>
                {itemsFiltrados.map(item => (
                  <div key={item.id} className={styles.itemCard}
                    onClick={() => agregarItem(tab === 'servicios' ? 'SERVICIO' : 'PRODUCTO', item)}>
                    <div className={styles.itemNombre}>{item.nombre}</div>
                    <div className={styles.itemPrecio}>
                      ${(tab === 'servicios' ? (item as Servicio).precio : (item as Producto).precio_minorista).toLocaleString('es-AR')}
                    </div>
                    {tab === 'productos' && (
                      <div className={styles.itemStock}>Stock: {(item as Producto).stock_actual}</div>
                    )}
                  </div>
                ))}
                {itemsFiltrados.length === 0 && (
                  <div className={styles.emptyItems}>Sin resultados</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho — ticket */}
        <div className={styles.rightPanel}>
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>Ticket</span>
              {carrito.length > 0 && <button className={styles.clearAllBtn} onClick={limpiar}>Limpiar</button>}
            </div>
            <div className={styles.cardBody}>
              {carrito.length === 0 ? (
                <div className={styles.emptyCart}>
                  <div>🛒</div>
                  <div>Seleccioná servicios o productos</div>
                </div>
              ) : (
                <div className={styles.carritoItems}>
                  {carrito.map(item => (
                    <div key={`${item.tipo}-${item.id}`} className={styles.carritoItem}>
                      <div className={styles.carritoInfo}>
                        <div className={styles.carritoNombre}>{item.nombre}</div>
                        <div className={styles.carritoTipo}>{item.tipo === 'SERVICIO' ? 'Servicio' : 'Producto'}</div>
                      </div>
                      <div className={styles.carritoControls}>
                        <button className={styles.qtyBtn} onClick={() => cambiarCantidad(item.id, item.tipo, -1)}>−</button>
                        <span className={styles.qty}>{item.cantidad}</span>
                        <button className={styles.qtyBtn} onClick={() => cambiarCantidad(item.id, item.tipo, 1)}>+</button>
                      </div>
                      <div className={styles.carritoSubtotal}>${(item.precio_unitario * item.cantidad).toLocaleString('es-AR')}</div>
                      <button className={styles.removeBtn} onClick={() => quitarItem(item.id, item.tipo)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.totales}>
                <div className={styles.totalesRow}>
                  <span>Subtotal</span>
                  <span>${subtotal.toLocaleString('es-AR')}</span>
                </div>
                <div className={styles.totalesRow}>
                  <span>Descuento</span>
                  <div className={styles.descuentoWrap}>
                    <input className={styles.descuentoInp} type="number" min="0" max="100"
                      value={descuento} onChange={e => setDescuento(e.target.value)} />
                    <span>%</span>
                  </div>
                </div>
                <div className={styles.totalesRow}>
                  <span>Seña aplicada</span>
                  <div className={styles.descuentoWrap}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>$</span>
                    <input className={styles.descuentoInp} type="number" min="0"
                      placeholder="0"
                      value={senaAplicada === '0' ? '' : senaAplicada}
                      onChange={e => setSenaAplicada(e.target.value || '0')}
                      style={{ width: 80 }} />
                  </div>
                </div>
                <div className={`${styles.totalesRow} ${styles.totalRow}`}>
                  <span>Total a cobrar</span>
                  <span className={styles.totalVal}>${total.toLocaleString('es-AR')}</span>
                </div>
              </div>

              <div className={styles.formGroup} style={{ marginTop: 14 }}>
                <label className={styles.formLabel}>Profesional</label>
                <select className={styles.formSel} value={profesionalId} onChange={e => setProfesionalId(e.target.value)}>
                  <option value="">Sin asignar</option>
                  {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Medio de pago</label>
                <div className={styles.mediosPago}>
                  {MEDIOS.map(m => (
                    <button key={m}
                      className={medioPago === m ? styles.medioPagoActive : styles.medioPago}
                      onClick={() => setMedioPago(m)}>
                      {MEDIO_PAGO_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notas</label>
                <input className={styles.formInp} value={notas}
                  onChange={e => setNotas(e.target.value)} placeholder="Observaciones…" />
              </div>

              {error && <div className={styles.errorBanner}>{error}</div>}

              {turnoYaFacturado && (
                <div style={{ background: '#FFF3CD', border: '1px solid #FFEAA7', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                  ⚠️ Este turno ya fue facturado.{' '}
                  {turnoYaFacturado.numComp && (
                    <span>Comprobante: <strong>#{String(turnoYaFacturado.numComp).padStart(6, '0')}</strong></span>
                  )}
                  {' — '}
                  <a href="/admin/ventas" style={{ color: '#856404', fontWeight: 600 }}>Ver en Ventas</a>
                  <button onClick={() => setTurnoYaFacturado(null)} style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#856404' }}>✕</button>
                </div>
              )}

              {!permisos.puede_cobrar ? (
                <div style={{ padding: '12px 16px', background: '#FFF8ED', border: '1px solid #E8AA3A', borderRadius: 8, fontSize: 13, color: '#8C6030', textAlign: 'center' }}>
                  No tenés permiso para cobrar. Solicitá acceso al administrador.
                </div>
              ) : (
                <button
                  className={styles.btnConfirmar}
                  onClick={handleVenta}
                  disabled={saving || carrito.length === 0}
                >
                  {saving ? 'Registrando…' : `Confirmar venta · $${total.toLocaleString('es-AR')}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CajaPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--muted)' }}>Cargando caja…</div>}>
      <CajaContent />
    </Suspense>
  )
}
