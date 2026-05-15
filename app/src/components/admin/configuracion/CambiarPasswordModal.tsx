'use client'

import { useState, useEffect } from 'react'
import styles from './UsuarioModal.module.css'
import { Usuario } from '@/types/usuarios'

interface Props {
  open: boolean
  usuario?: Usuario | null
  esSelf: boolean
  onClose: () => void
  onCambiada: () => void
}

export default function CambiarPasswordModal({ open, usuario, esSelf, onClose, onCambiada }: Props) {
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({ actual: '', nueva: '', confirmar: '' })
      setErrores({})
      setError('')
    }
  }, [open])

  function validar() {
    const e: Record<string, string> = {}
    if (esSelf && !form.actual) e.actual = 'Requerida'
    if (!form.nueva) e.nueva = 'Requerida'
    else if (form.nueva.length < 6) e.nueva = 'Mínimo 6 caracteres'
    if (form.nueva !== form.confirmar) e.confirmar = 'No coinciden'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validar() || !usuario) return
    setLoading(true)
    setError('')

    try {
      const body: Record<string, string> = { password_nueva: form.nueva }
      if (esSelf) body.password_actual = form.actual

      const res = await fetch(`${(process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com')}/usuarios/${usuario.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al cambiar contraseña')
      }

      onCambiada()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !usuario) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.title}>
            Cambiar contraseña
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.errorBanner}>{error}</div>}

          <div style={{ fontSize: 13, color: '#8C847A', marginBottom: -8 }}>
            Usuario: <strong style={{ color: '#1C1814' }}>{usuario.nombre} {usuario.apellido}</strong>
          </div>

          <div className={styles.grid} style={{ gridTemplateColumns: '1fr' }}>
            {esSelf && (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Contraseña actual *</label>
                <input
                  className={`${styles.formInp} ${errores.actual ? styles.inputError : ''}`}
                  type="password"
                  value={form.actual}
                  onChange={e => setForm(f => ({ ...f, actual: e.target.value }))}
                  placeholder="Tu contraseña actual"
                />
                {errores.actual && <span className={styles.fieldError}>{errores.actual}</span>}
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nueva contraseña *</label>
              <input
                className={`${styles.formInp} ${errores.nueva ? styles.inputError : ''}`}
                type="password"
                value={form.nueva}
                onChange={e => setForm(f => ({ ...f, nueva: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
              {errores.nueva && <span className={styles.fieldError}>{errores.nueva}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Confirmar nueva contraseña *</label>
              <input
                className={`${styles.formInp} ${errores.confirmar ? styles.inputError : ''}`}
                type="password"
                value={form.confirmar}
                onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))}
                placeholder="Repetir nueva contraseña"
              />
              {errores.confirmar && <span className={styles.fieldError}>{errores.confirmar}</span>}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </div>
  )
}
