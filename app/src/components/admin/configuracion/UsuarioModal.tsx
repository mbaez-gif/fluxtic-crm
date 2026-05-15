'use client'

import { useState, useEffect } from 'react'
import styles from './UsuarioModal.module.css'
import {
  Usuario, Rol, ROL_LABELS, COLORES_DISPONIBLES,
  CreateUsuarioPayload, UpdateUsuarioPayload,
  Permisos, PERMISOS_DEFAULT, PERMISOS_FULL,
} from '@/types/usuarios'
import PermisosEditor from './PermisosEditor'

interface Props {
  open: boolean
  usuario?: Usuario | null
  onClose: () => void
  onGuardado: (u: Usuario) => void
}

const ROLES: Rol[] = ['EMPLEADA', 'ADMIN', 'OWNER']

export default function UsuarioModal({ open, usuario, onClose, onGuardado }: Props) {
  const esEdicion = !!usuario

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    confirmar: '',
    rol: 'EMPLEADA' as Rol,
    telefono: '',
    color: COLORES_DISPONIBLES[0],
  })
  const [permisos, setPermisos] = useState<Permisos>(PERMISOS_DEFAULT)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      if (usuario) {
        setForm({
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          email: usuario.email,
          password: '',
          confirmar: '',
          rol: usuario.rol,
          telefono: usuario.telefono ?? '',
          color: usuario.color ?? COLORES_DISPONIBLES[0],
        })
        setPermisos({
          puede_ver_caja:                usuario.puede_ver_caja                ?? false,
          puede_cobrar:                  usuario.puede_cobrar                  ?? false,
          puede_anular_ventas:           usuario.puede_anular_ventas           ?? false,
          puede_reimprimir_comprobantes: usuario.puede_reimprimir_comprobantes ?? false,
          puede_ver_ventas_dia:          usuario.puede_ver_ventas_dia          ?? false,
          puede_ver_reportes:            usuario.puede_ver_reportes            ?? false,
          puede_gestionar_turnos:        usuario.puede_gestionar_turnos        ?? true,
          puede_gestionar_clientes:      usuario.puede_gestionar_clientes      ?? false,
          puede_gestionar_servicios:     usuario.puede_gestionar_servicios     ?? false,
          puede_gestionar_productos:     usuario.puede_gestionar_productos     ?? false,
          puede_gestionar_configuracion: usuario.puede_gestionar_configuracion ?? false,
          puede_gestionar_usuarios:      usuario.puede_gestionar_usuarios      ?? false,
          puede_gestionar_integraciones: usuario.puede_gestionar_integraciones ?? false,
        })
      } else {
        setForm({
          nombre: '', apellido: '', email: '',
          password: '', confirmar: '',
          rol: 'EMPLEADA',
          telefono: '',
          color: COLORES_DISPONIBLES[0],
        })
        setPermisos(PERMISOS_DEFAULT)
      }
      setErrores({})
      setError('')
    }
  }, [open, usuario])

  function validar(): boolean {
    const e: Record<string, string> = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (!form.apellido.trim()) e.apellido = 'Requerido'
    if (!form.email.trim()) e.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido'
    if (!esEdicion) {
      if (!form.password) e.password = 'Requerido'
      else if (form.password.length < 6) e.password = 'Mínimo 6 caracteres'
      if (form.password !== form.confirmar) e.confirmar = 'Las contraseñas no coinciden'
    }
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validar()) return
    setLoading(true)
    setError('')

    try {
      const url = esEdicion
        ? `/api/proxy/usuarios/${usuario!.id}`
        : `/api/proxy/usuarios`
      const method = esEdicion ? 'PATCH' : 'POST'

      const body: CreateUsuarioPayload | UpdateUsuarioPayload = esEdicion
        ? {
            nombre: form.nombre,
            apellido: form.apellido,
            email: form.email,
            rol: form.rol,
            telefono: form.telefono || undefined,
            color: form.color,
            ...permisos,
          }
        : {
            nombre: form.nombre,
            apellido: form.apellido,
            email: form.email,
            password: form.password,
            rol: form.rol,
            telefono: form.telefono || undefined,
            color: form.color,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }

      const guardado: Usuario = await res.json()
      onGuardado(guardado)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.title}>{esEdicion ? 'Editar usuario' : 'Nuevo usuario'}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.errorBanner}>{error}</div>}

          {/* Color avatar */}
          <div className={styles.colorSection}>
            <div className={styles.formLabel}>Color de perfil</div>
            <div className={styles.colorPicker}>
              {COLORES_DISPONIBLES.map(c => (
                <button
                  key={c}
                  className={`${styles.colorDot} ${form.color === c ? styles.colorDotActive : ''}`}
                  style={{ background: c }}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  type="button"
                />
              ))}
              <div className={styles.avatarPreview} style={{ background: form.color }}>
                {form.nombre ? form.nombre[0].toUpperCase() : '?'}
              </div>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nombre *</label>
              <input
                className={`${styles.formInp} ${errores.nombre ? styles.inputError : ''}`}
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre"
              />
              {errores.nombre && <span className={styles.fieldError}>{errores.nombre}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Apellido *</label>
              <input
                className={`${styles.formInp} ${errores.apellido ? styles.inputError : ''}`}
                value={form.apellido}
                onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                placeholder="Apellido"
              />
              {errores.apellido && <span className={styles.fieldError}>{errores.apellido}</span>}
            </div>

            <div className={`${styles.formGroup} ${styles.full}`}>
              <label className={styles.formLabel}>Email *</label>
              <input
                className={`${styles.formInp} ${errores.email ? styles.inputError : ''}`}
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@dominio.com"
              />
              {errores.email && <span className={styles.fieldError}>{errores.email}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Teléfono</label>
              <input
                className={styles.formInp}
                type="tel"
                value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
                placeholder="+54 341 …"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Rol *</label>
              <select
                className={styles.formSel}
                value={form.rol}
                onChange={e => setForm(f => ({ ...f, rol: e.target.value as Rol }))}
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{ROL_LABELS[r]}</option>
                ))}
              </select>
            </div>

            {!esEdicion && (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Contraseña *</label>
                  <input
                    className={`${styles.formInp} ${errores.password ? styles.inputError : ''}`}
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Mínimo 6 caracteres"
                  />
                  {errores.password && <span className={styles.fieldError}>{errores.password}</span>}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Confirmar contraseña *</label>
                  <input
                    className={`${styles.formInp} ${errores.confirmar ? styles.inputError : ''}`}
                    type="password"
                    value={form.confirmar}
                    onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))}
                    placeholder="Repetir contraseña"
                  />
                  {errores.confirmar && <span className={styles.fieldError}>{errores.confirmar}</span>}
                </div>
              </>
            )}
          </div>

          {esEdicion && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <PermisosEditor
                rol={form.rol}
                permisos={permisos}
                onChange={p => setPermisos(p)}
                disabled={loading}
              />
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}
