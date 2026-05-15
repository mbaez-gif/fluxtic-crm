'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import styles from './configuracion.module.css'
import { Usuario, ROL_LABELS, ROL_COLORS } from '@/types/usuarios'
import UsuarioModal from '@/components/admin/configuracion/UsuarioModal'
import CambiarPasswordModal from '@/components/admin/configuracion/CambiarPasswordModal'
import HorariosModal from '@/components/admin/configuracion/HorariosModal'

type ConfirmAction = {
  titulo: string
  mensaje: string
  onConfirm: () => void
}

export default function ConfiguracionPage() {
  const { data: session } = useSession()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modales
  const [modalUsuario, setModalUsuario] = useState(false)
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null)
  const [modalPassword, setModalPassword] = useState(false)
  const [usuarioPassword, setUsuarioPassword] = useState<Usuario | null>(null)
  const [modalHorarios, setModalHorarios] = useState(false)
  const [usuarioHorarios, setUsuarioHorarios] = useState<Usuario | null>(null)
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [toastMsg, setToastMsg] = useState('')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com'

  // Config negocio
  const [negocio, setNegocio] = useState({
    nombre: 'Delfina Paz',
    direccion: 'San Martín 2365 L11, Santa Fe',
    telefono: '',
    email: 'info@delfinapaz.com',
    instagram: '',
    color_marca: '#C8A882',
  })
  const [negocioGuardando, setNegocioGuardando] = useState(false)

  // Config señas/reservas
  const [reservas, setReservas] = useState({
    metodo_sena: 'SIN_SENA' as 'MERCADOPAGO' | 'TRANSFERENCIA' | 'AMBOS' | 'SIN_SENA',
    vencimiento_minutos: 30,
    vencimiento_transf_horas: 24,
    mp_link_alternativo: '',
    alias_transferencia: '',
    titular_alias: '',
    mensaje_sena: '',
  })
  const [reservasGuardando, setReservasGuardando] = useState(false)

  // Config plantilla PDF
  const [plantilla, setPlantilla] = useState({
    titulo: 'Comprobante de venta',
    footer: 'Gracias por tu compra',
    color_header: '#C8A882',
    mostrar_logo: true,
    mostrar_profesional: true,
  })
  const [plantillaGuardando, setPlantillaGuardando] = useState(false)

  // Load all configs on mount
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/configuracion/negocio`).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/configuracion/reservas`).then(r => r.ok ? r.json() : null),
      fetch(`${API_URL}/configuracion/plantilla-pdf`).then(r => r.ok ? r.json() : null),
    ]).then(([neg, res, pdf]) => {
      if (neg) setNegocio(n => ({ ...n, ...neg }))
      if (res) setReservas(r => ({ ...r, ...res }))
      if (pdf) setPlantilla(p => ({ ...p, ...pdf }))
    }).catch(() => {})
  }, []) // eslint-disable-line

  const cargarUsuarios = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com') + '/usuarios')
      if (!res.ok) throw new Error('Error al cargar usuarios')
      const data = await res.json()
      const lista: Usuario[] = Array.isArray(data) ? data : data.data ?? []
      setUsuarios(lista)
    } catch {
      setError('No se pudieron cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarUsuarios()
  }, [cargarUsuarios])

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3000)
  }

  function abrirNuevo() {
    setUsuarioEditando(null)
    setModalUsuario(true)
  }

  function abrirEditar(u: Usuario) {
    setUsuarioEditando(u)
    setModalUsuario(true)
  }

  function abrirPassword(u: Usuario) {
    setUsuarioPassword(u)
    setModalPassword(true)
  }

  function abrirHorarios(u: Usuario) {
    setUsuarioHorarios(u)
    setModalHorarios(true)
  }

  function handleGuardado(u: Usuario) {
    setUsuarios(prev => {
      const existe = prev.find(x => x.id === u.id)
      if (existe) return prev.map(x => x.id === u.id ? u : x)
      return [...prev, u]
    })
    setModalUsuario(false)
    showToast(usuarioEditando ? 'Usuario actualizado' : 'Usuario creado correctamente')
    // Re-fetch para asegurar consistencia con backend (en caso de campos
    // calculados o defaults que se setean del lado del API).
    cargarUsuarios()
  }

  async function toggleActivo(u: Usuario) {
    const accion = u.activo ? 'desactivar' : 'activar'
    setConfirm({
      titulo: `${u.activo ? 'Desactivar' : 'Activar'} usuario`,
      mensaje: `¿Confirmar ${accion} a ${u.nombre} ${u.apellido}?`,
      onConfirm: async () => {
        setConfirm(null)
        try {
          const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com')}/usuarios/${u.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: !u.activo }),
          })
          if (!res.ok) throw new Error()
          const actualizado = await res.json()
          setUsuarios(prev => prev.map(x => x.id === u.id ? actualizado : x))
          showToast(`Usuario ${actualizado.activo ? 'activado' : 'desactivado'}`)
        } catch {
          showToast('Error al actualizar estado')
        }
      }
    })
  }

  async function guardarConfig(path: string, payload: unknown, label: string) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let detalle = `HTTP ${res.status}`
        try {
          const j = await res.json()
          detalle = j?.error || j?.message || detalle
        } catch { /* respuesta no es JSON */ }
        showToast(`Error al guardar ${label}: ${detalle}`)
        return false
      }
      const saved = await res.json().catch(() => null)
      showToast(`${label} guardado`)
      return saved ?? true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'error desconocido'
      showToast(`Error de red al guardar ${label}: ${msg}`)
      return false
    }
  }

  async function guardarNegocio() {
    setNegocioGuardando(true)
    const saved = await guardarConfig('/configuracion/negocio', negocio, 'datos del negocio')
    if (saved && typeof saved === 'object') setNegocio(n => ({ ...n, ...(saved as object) }))
    setNegocioGuardando(false)
  }

  async function guardarReservas() {
    setReservasGuardando(true)
    const saved = await guardarConfig('/configuracion/reservas', reservas, 'configuración de señas')
    if (saved && typeof saved === 'object') setReservas(r => ({ ...r, ...(saved as object) }))
    setReservasGuardando(false)
  }

  async function guardarPlantilla() {
    setPlantillaGuardando(true)
    const saved = await guardarConfig('/configuracion/plantilla-pdf', plantilla, 'plantilla PDF')
    if (saved && typeof saved === 'object') setPlantilla(p => ({ ...p, ...(saved as object) }))
    setPlantillaGuardando(false)
  }

  const esSelf = (u: Usuario) => u.email === session?.user?.email

  const activos = usuarios.filter(u => u.activo)
  const inactivos = usuarios.filter(u => !u.activo)

  return (
    <div className={styles.page}>
      {/* Toast */}
      {toastMsg && (
        <div className={styles.toast}>{toastMsg}</div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <div className={styles.confirmTitle}>{confirm.titulo}</div>
            <div className={styles.confirmMsg}>{confirm.mensaje}</div>
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost} onClick={() => setConfirm(null)}>Cancelar</button>
              <button className={styles.btnPrimary} onClick={confirm.onConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Configuración</h1>
          <p className={styles.pageSub}>Integraciones · Usuarios · Preferencias</p>
        </div>
      </div>

      <div className={styles.cfgGrid}>
        {/* ── Negocio ── */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Negocio</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nombre del negocio</label>
              <input
                className={styles.formInp}
                value={negocio.nombre}
                onChange={e => setNegocio(n => ({ ...n, nombre: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Dirección</label>
              <input
                className={styles.formInp}
                value={negocio.direccion}
                onChange={e => setNegocio(n => ({ ...n, direccion: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email corporativo</label>
              <input
                className={styles.formInp}
                type="email"
                value={negocio.email}
                onChange={e => setNegocio(n => ({ ...n, email: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Teléfono / WhatsApp del negocio *</label>
              <input
                className={styles.formInp}
                value={negocio.telefono}
                onChange={e => setNegocio(n => ({ ...n, telefono: e.target.value }))}
                placeholder="Ej: 3435310002"
              />
              <small style={{ fontSize: 11, color: 'var(--muted)' }}>
                Este número se usa para el botón de WhatsApp del link público de reservas. Sin él, las clientas no pueden coordinar el pago de la seña.
              </small>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Instagram</label>
              <input
                className={styles.formInp}
                placeholder="@usuario"
                value={negocio.instagram}
                onChange={e => setNegocio(n => ({ ...n, instagram: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Color de marca</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={negocio.color_marca}
                  onChange={e => setNegocio(n => ({ ...n, color_marca: e.target.value }))}
                  style={{ width: 40, height: 36, border: '1px solid #E4DDD6', borderRadius: 6, cursor: 'pointer', padding: 2 }}
                />
                <input
                  className={styles.formInp}
                  value={negocio.color_marca}
                  onChange={e => setNegocio(n => ({ ...n, color_marca: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <button
              className={styles.btnPrimary}
              onClick={guardarNegocio}
              disabled={negocioGuardando}
            >
              {negocioGuardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        {/* ── Integraciones ── */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Integraciones</span>
          </div>
          <div className={styles.sectionBody}>
            {[
              { label: 'WhatsApp Cloud API', sub: 'Número dedicado · Templates activos', on: true },
              { label: 'Instagram Graph API', sub: '@delfinapaz.ok · DMs y comentarios', on: true },
              { label: 'Tienda Nube', sub: 'Webhooks activos · Stock sincronizado', on: true },
              { label: 'n8n Automatizaciones', sub: 'n8n-delfina.fluxtic.com', on: true },
            ].map((item, i) => (
              <IntegrationRow key={i} label={item.label} sub={item.sub} defaultOn={item.on} />
            ))}
          </div>
        </div>

        {/* ── Señas / Reservas ── */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Señas y reservas</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Método de seña</label>
              <select
                className={styles.formInp}
                value={reservas.metodo_sena}
                onChange={e => setReservas(r => ({ ...r, metodo_sena: e.target.value as any }))}
              >
                <option value="SIN_SENA">Sin seña (confirmar directo)</option>
                <option value="MERCADOPAGO">Mercado Pago (link de cobro)</option>
                <option value="TRANSFERENCIA">Transferencia bancaria</option>
                <option value="AMBOS">Ambos (cliente elige)</option>
              </select>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
              El porcentaje de seña se configura por servicio en <strong>Servicios → Editar servicio</strong>.
              Acá solo definís el método de cobro general.
            </div>
            {(reservas.metodo_sena === 'MERCADOPAGO' || reservas.metodo_sena === 'AMBOS') && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Vencimiento link MP (minutos)</label>
                <input
                  className={styles.formInp}
                  type="number"
                  min={5}
                  value={reservas.vencimiento_minutos}
                  onChange={e => setReservas(r => ({ ...r, vencimiento_minutos: Number(e.target.value) }))}
                />
                <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                  Tiempo que tiene la clienta para pagar el link de MP antes de liberar el slot.
                </small>
              </div>
            )}
            {(reservas.metodo_sena === 'TRANSFERENCIA' || reservas.metodo_sena === 'AMBOS') && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Vencimiento transferencia (horas)</label>
                <input
                  className={styles.formInp}
                  type="number"
                  min={1}
                  value={reservas.vencimiento_transf_horas}
                  onChange={e => setReservas(r => ({ ...r, vencimiento_transf_horas: Number(e.target.value) }))}
                />
                <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                  Tiempo que tiene la clienta para transferir y subir el comprobante.
                </small>
              </div>
            )}
            {(reservas.metodo_sena === 'MERCADOPAGO' || reservas.metodo_sena === 'AMBOS') && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Link alternativo de Mercado Pago (opcional)</label>
                <input
                  className={styles.formInp}
                  placeholder="https://mpago.la/..."
                  value={reservas.mp_link_alternativo}
                  onChange={e => setReservas(r => ({ ...r, mp_link_alternativo: e.target.value }))}
                />
                <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                  Link fijo de MP (ej: cobranza). Si lo dejás vacío, el sistema genera un link único por reserva via Checkout.
                </small>
              </div>
            )}
            {(reservas.metodo_sena === 'TRANSFERENCIA' || reservas.metodo_sena === 'AMBOS') && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Alias de Mercado Pago / CBU</label>
                  <input
                    className={styles.formInp}
                    placeholder="delfina.paz.mp"
                    value={reservas.alias_transferencia}
                    onChange={e => setReservas(r => ({ ...r, alias_transferencia: e.target.value }))}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                    Alias adonde la clienta transfiere desde su homebanking. Puede ser tu alias MP, alias bancario o CBU.
                  </small>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Titular de la cuenta</label>
                  <input
                    className={styles.formInp}
                    placeholder="Delfina Paz"
                    value={reservas.titular_alias}
                    onChange={e => setReservas(r => ({ ...r, titular_alias: e.target.value }))}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                    Aparece junto al alias para que la clienta verifique el destinatario.
                  </small>
                </div>
              </>
            )}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Mensaje de seña (WhatsApp / link público)</label>
              <textarea
                className={styles.formInp}
                rows={3}
                placeholder="Ej: Para confirmar tu turno, enviá el comprobante de la transferencia respondiendo este mensaje."
                value={reservas.mensaje_sena}
                onChange={e => setReservas(r => ({ ...r, mensaje_sena: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>
            <button className={styles.btnPrimary} onClick={guardarReservas} disabled={reservasGuardando}>
              {reservasGuardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        {/* ── Plantilla PDF ── */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Plantilla de comprobante PDF</span>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Título del comprobante</label>
              <input
                className={styles.formInp}
                value={plantilla.titulo}
                onChange={e => setPlantilla(p => ({ ...p, titulo: e.target.value }))}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Texto de pie de página</label>
              <textarea
                className={styles.formInp}
                rows={2}
                value={plantilla.footer}
                onChange={e => setPlantilla(p => ({ ...p, footer: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Color de encabezado</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={plantilla.color_header}
                  onChange={e => setPlantilla(p => ({ ...p, color_header: e.target.value }))}
                  style={{ width: 40, height: 36, border: '1px solid #E4DDD6', borderRadius: 6, cursor: 'pointer', padding: 2 }}
                />
                <input
                  className={styles.formInp}
                  value={plantilla.color_header}
                  onChange={e => setPlantilla(p => ({ ...p, color_header: e.target.value }))}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div className={styles.cfgRow} style={{ paddingBottom: 0 }}>
              <div>
                <div className={styles.cfgLabel}>Mostrar logo</div>
                <div className={styles.cfgLabelSub}>Incluye el nombre del negocio en el encabezado</div>
              </div>
              <button
                className={`${styles.toggle} ${plantilla.mostrar_logo ? styles.toggleOn : styles.toggleOff}`}
                onClick={() => setPlantilla(p => ({ ...p, mostrar_logo: !p.mostrar_logo }))}
              />
            </div>
            <div className={styles.cfgRow} style={{ paddingBottom: 0 }}>
              <div>
                <div className={styles.cfgLabel}>Mostrar profesional</div>
                <div className={styles.cfgLabelSub}>Incluye nombre del profesional en el comprobante</div>
              </div>
              <button
                className={`${styles.toggle} ${plantilla.mostrar_profesional ? styles.toggleOn : styles.toggleOff}`}
                onClick={() => setPlantilla(p => ({ ...p, mostrar_profesional: !p.mostrar_profesional }))}
              />
            </div>
            <button className={styles.btnPrimary} onClick={guardarPlantilla} disabled={plantillaGuardando} style={{ marginTop: 8 }}>
              {plantillaGuardando ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>

        {/* ── Usuarios / Profesionales ── */}
        <div className={`${styles.section} ${styles.sectionFull}`}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Usuarios y profesionales</span>
            <button className={styles.btnPrimary} onClick={abrirNuevo} style={{ fontSize: 12, padding: '6px 14px' }}>
              + Agregar usuario
            </button>
          </div>
          <div className={styles.sectionBody}>
            {loading ? (
              <div className={styles.loading}>Cargando usuarios…</div>
            ) : error ? (
              <div className={styles.errorMsg}>{error}</div>
            ) : (
              <>
                <table className={styles.tbl}>
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Rol</th>
                      <th>Email</th>
                      <th>Teléfono</th>
                      <th>Turnos</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activos.map(u => (
                      <UsuarioRow
                        key={u.id}
                        usuario={u}
                        esSelf={esSelf(u)}
                        onEditar={() => abrirEditar(u)}
                        onPassword={() => abrirPassword(u)}
                        onHorarios={() => abrirHorarios(u)}
                        onToggle={() => toggleActivo(u)}
                      />
                    ))}
                    {inactivos.length > 0 && (
                      <>
                        <tr>
                          <td colSpan={7} className={styles.separatorRow}>
                            Inactivos ({inactivos.length})
                          </td>
                        </tr>
                        {inactivos.map(u => (
                          <UsuarioRow
                            key={u.id}
                            usuario={u}
                            esSelf={esSelf(u)}
                            onEditar={() => abrirEditar(u)}
                            onPassword={() => abrirPassword(u)}
                            onHorarios={() => abrirHorarios(u)}
                            onToggle={() => toggleActivo(u)}
                          />
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
                {usuarios.length === 0 && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>👥</div>
                    <div className={styles.emptyTitle}>Sin usuarios</div>
                    <div className={styles.emptySub}>Creá el primer usuario del equipo</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Notificaciones ── */}
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <span className={styles.sectionTitle}>Notificaciones</span>
          </div>
          <div className={styles.sectionBody}>
            {[
              { label: 'Turno nuevo', sub: 'WA al negocio cuando se reserva', on: true },
              { label: 'Cancelación de turno', sub: 'Alerta inmediata por WA', on: true },
              { label: 'Stock crítico', sub: 'Cuando baja del mínimo', on: true },
              { label: 'Reporte diario 8am', sub: 'Resumen por WhatsApp', on: false },
            ].map((item, i) => (
              <IntegrationRow key={i} label={item.label} sub={item.sub} defaultOn={item.on} />
            ))}
          </div>
        </div>
      </div>

      {/* Modales */}
      <UsuarioModal
        open={modalUsuario}
        usuario={usuarioEditando}
        onClose={() => setModalUsuario(false)}
        onGuardado={handleGuardado}
      />
      <CambiarPasswordModal
        open={modalPassword}
        usuario={usuarioPassword}
        esSelf={usuarioPassword ? esSelf(usuarioPassword) : false}
        onClose={() => setModalPassword(false)}
        onCambiada={() => showToast('Contraseña actualizada correctamente')}
      />
      <HorariosModal
        open={modalHorarios}
        usuario={usuarioHorarios}
        onClose={() => setModalHorarios(false)}
        onGuardado={() => showToast('Horarios actualizados')}
      />
    </div>
  )
}

// ── Sub-componentes ─────────────────────────────────────────────

function UsuarioRow({
  usuario: u,
  esSelf,
  onEditar,
  onPassword,
  onHorarios,
  onToggle,
}: {
  usuario: Usuario
  esSelf: boolean
  onEditar: () => void
  onPassword: () => void
  onHorarios: () => void
  onToggle: () => void
}) {
  const esProfesional = u.rol === 'OWNER' || u.rol === 'EMPLEADA'
  return (
    <tr className={u.activo ? '' : styles.rowInactivo}>
      <td>
        <div className={styles.userCell}>
          <div
            className={styles.userAvatar}
            style={{ background: u.color || '#C8A882' }}
          >
            {u.nombre[0].toUpperCase()}
          </div>
          <div>
            <div className={styles.userName}>
              {u.nombre} {u.apellido}
              {esSelf && <span className={styles.selfBadge}>Vos</span>}
            </div>
            <div className={styles.userSub}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={`${styles.segChip} ${styles['seg-' + ROL_COLORS[u.rol]]}`}>
          {ROL_LABELS[u.rol]}
        </span>
      </td>
      <td className={styles.tblMuted}>{u.email}</td>
      <td className={styles.tblMuted}>{u.telefono || '—'}</td>
      <td className={styles.tblMuted}>{u._count?.turnos ?? 0}</td>
      <td>
        <span className={`${styles.statusBadge} ${u.activo ? styles.sConfirmado : styles.sCancelado}`}>
          {u.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td>
        <div className={styles.tblActions}>
          <button className={styles.actBtn} onClick={onEditar} title="Editar">✏️</button>
          <button className={styles.actBtn} onClick={onPassword} title="Cambiar contraseña">🔑</button>
          {esProfesional && (
            <button className={styles.actBtn} onClick={onHorarios} title="Configurar horarios">🕐</button>
          )}
          {u.rol !== 'OWNER' && (
            <button
              className={styles.actBtn}
              onClick={onToggle}
              title={u.activo ? 'Desactivar' : 'Activar'}
            >
              {u.activo ? '🚫' : '✅'}
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

function IntegrationRow({
  label,
  sub,
  defaultOn,
}: {
  label: string
  sub: string
  defaultOn: boolean
}) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div className={styles.cfgRow}>
      <div>
        <div className={styles.cfgLabel}>{label}</div>
        <div className={styles.cfgLabelSub}>{sub}</div>
      </div>
      <button
        className={`${styles.toggle} ${on ? styles.toggleOn : styles.toggleOff}`}
        onClick={() => setOn(v => !v)}
        type="button"
      />
    </div>
  )
}
