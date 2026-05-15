'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './servicios.module.css'
import {
  Servicio, CategoriaServicio,
  CATEGORIA_SERVICIO_LABELS, CATEGORIA_SERVICIO_EMOJIS,
  API_BASE
} from '@/types/operaciones'

const CATEGORIAS: CategoriaServicio[] = ['MANOS_PIES', 'CEJAS_PESTANAS', 'LABIOS', 'FACIAL', 'OTRO']

const initForm = {
  nombre: '', descripcion: '', categoria: 'MANOS_PIES' as CategoriaServicio,
  duracion_min: '60', precio: '', activo: true,
}

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Servicio | null>(null)
  const [form, setForm] = useState(initForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'todos' | 'activos' | 'inactivos'>('activos')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/servicios?activo=true`)
      const data = await res.json()
      const lista: Servicio[] = Array.isArray(data) ? data : data.data ?? []
      setServicios(lista)
    } catch { setError('Error al cargar servicios') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  function showToast(msg: string) {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  function abrirNuevo() {
    setEditando(null); setForm(initForm); setError(''); setModalOpen(true)
  }

  function abrirEditar(s: Servicio) {
    setEditando(s)
    setForm({
      nombre: s.nombre, descripcion: s.descripcion ?? '',
      categoria: s.categoria, duracion_min: String(s.duracion_min),
      precio: String(s.precio), activo: s.activo,
    })
    setError(''); setModalOpen(true)
  }

  async function handleGuardar() {
    if (!form.nombre || !form.precio) { setError('Nombre y precio son obligatorios'); return }
    setSaving(true); setError('')
    try {
      const url = editando ? `${API_BASE}/servicios/${editando.id}` : `${API_BASE}/servicios`
      const method = editando ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre, descripcion: form.descripcion || null,
          categoria: form.categoria, duracion_min: Number(form.duracion_min),
          precio: Number(form.precio), activo: form.activo,
        })
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Error') }
      const guardado: Servicio = await res.json()
      setServicios(prev => editando
        ? prev.map(s => s.id === guardado.id ? guardado : s)
        : [...prev, guardado])
      setModalOpen(false)
      showToast(editando ? 'Servicio actualizado' : 'Servicio creado')
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function toggleActivo(s: Servicio) {
    try {
      const res = await fetch(`${API_BASE}/servicios/${s.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !s.activo })
      })
      if (!res.ok) throw new Error()
      const actualizado = await res.json()
      setServicios(prev => prev.map(x => x.id === s.id ? actualizado : x))
      showToast(`Servicio ${actualizado.activo ? 'activado' : 'desactivado'}`)
    } catch { showToast('Error al actualizar') }
  }

  const filtrados = servicios.filter(s =>
    filtroActivo === 'todos' ? true : filtroActivo === 'activos' ? s.activo : !s.activo
  )

  return (
    <div className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Servicios</h1>
          <p className={styles.pageSub}>Catálogo · Duración · Precios</p>
        </div>
        <button className={styles.btnPrimary} onClick={abrirNuevo}>
          + Nuevo servicio
        </button>
      </div>

      {/* Filtros */}
      <div className={styles.toolbar}>
        {(['activos', 'inactivos', 'todos'] as const).map(f => (
          <button
            key={f}
            className={filtroActivo === f ? styles.btnPrimary : styles.btnGhost}
            onClick={() => setFiltroActivo(f)}
            style={{ fontSize: 11, padding: '5px 12px' }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className={styles.count}>{filtrados.length} servicios</span>
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando servicios…</div>
      ) : (
        <div className={styles.grid}>
          {filtrados.map(s => (
            <div key={s.id} className={`${styles.card} ${!s.activo ? styles.cardInactivo : ''}`}>
              <div className={styles.cardEmoji}>{CATEGORIA_SERVICIO_EMOJIS[s.categoria]}</div>
              <div className={styles.cardBody}>
                <div className={styles.cardNombre}>{s.nombre}</div>
                <div className={styles.cardMeta}>
                  {CATEGORIA_SERVICIO_LABELS[s.categoria]} · {s.duracion_min} min
                </div>
                {s.descripcion && <div className={styles.cardDesc}>{s.descripcion}</div>}
                <div className={styles.cardPrecio}>${s.precio.toLocaleString('es-AR')}</div>
                {s._count && (
                  <div className={styles.cardTurnos}>{s._count.turnos} turnos realizados</div>
                )}
              </div>
              <div className={styles.cardActions}>
                <button className={styles.actBtn} onClick={() => abrirEditar(s)} title="Editar">✏️</button>
                <button
                  className={styles.actBtn}
                  onClick={() => toggleActivo(s)}
                  title={s.activo ? 'Desactivar' : 'Activar'}
                >
                  {s.activo ? '🚫' : '✅'}
                </button>
              </div>
              {!s.activo && <div className={styles.inactivoBadge}>Inactivo</div>}
            </div>
          ))}

          {/* Card agregar */}
          <div className={styles.cardAdd} onClick={abrirNuevo}>
            <div className={styles.cardAddIcon}>+</div>
            <div className={styles.cardAddLabel}>Agregar servicio</div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className={styles.overlay} onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHead}>
              <h2 className={styles.modalTitle}>{editando ? 'Editar servicio' : 'Nuevo servicio'}</h2>
              <button className={styles.closeBtn} onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {error && <div className={styles.errorBanner}>{error}</div>}

              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.full}`}>
                  <label className={styles.formLabel}>Nombre *</label>
                  <input className={styles.formInp} value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej: Bblips, Manicura francesa…" />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Categoría *</label>
                  <select className={styles.formSel} value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaServicio }))}>
                    {CATEGORIAS.map(c => (
                      <option key={c} value={c}>{CATEGORIA_SERVICIO_LABELS[c]}</option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Duración (min) *</label>
                  <input className={styles.formInp} type="number" value={form.duracion_min}
                    onChange={e => setForm(f => ({ ...f, duracion_min: e.target.value }))}
                    placeholder="60" />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Precio *</label>
                  <input className={styles.formInp} type="number" value={form.precio}
                    onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
                    placeholder="0" />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Estado</label>
                  <select className={styles.formSel} value={form.activo ? 'true' : 'false'}
                    onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'true' }))}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>

                <div className={`${styles.formGroup} ${styles.full}`}>
                  <label className={styles.formLabel}>Descripción</label>
                  <textarea className={styles.formTxt} value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Descripción para el catálogo…" />
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={handleGuardar} disabled={saving}>
                {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear servicio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
