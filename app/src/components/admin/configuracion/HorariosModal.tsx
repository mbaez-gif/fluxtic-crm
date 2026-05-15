'use client'

import { useEffect, useState } from 'react'
import styles from './UsuarioModal.module.css'
import { Usuario } from '@/types/usuarios'

interface HorarioBloque {
  id?: string
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  activo: boolean
}

interface Props {
  open: boolean
  usuario?: Usuario | null
  onClose: () => void
  onGuardado: () => void
}

const DIAS = [
  { idx: 1, label: 'Lunes' },
  { idx: 2, label: 'Martes' },
  { idx: 3, label: 'Miércoles' },
  { idx: 4, label: 'Jueves' },
  { idx: 5, label: 'Viernes' },
  { idx: 6, label: 'Sábado' },
  { idx: 0, label: 'Domingo' },
]

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com'

export default function HorariosModal({ open, usuario, onClose, onGuardado }: Props) {
  const [bloques, setBloques] = useState<HorarioBloque[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !usuario) return
    setLoading(true)
    setError('')
    fetch(`${API_URL}/usuarios/${usuario.id}/horarios`)
      .then(r => r.ok ? r.json() : { data: [] })
      .then(json => {
        const data = (json?.data ?? []) as HorarioBloque[]
        setBloques(data.length ? data : defaultBloques())
      })
      .catch(() => setBloques(defaultBloques()))
      .finally(() => setLoading(false))
  }, [open, usuario])

  function agregarBloque(dia: number) {
    setBloques(prev => [...prev, { dia_semana: dia, hora_inicio: '09:00', hora_fin: '13:00', activo: true }])
  }

  function actualizar(idx: number, patch: Partial<HorarioBloque>) {
    setBloques(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b))
  }

  function eliminar(idx: number) {
    setBloques(prev => prev.filter((_, i) => i !== idx))
  }

  async function guardar() {
    if (!usuario) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/usuarios/${usuario.id}/horarios`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horarios: bloques.filter(b => b.activo) }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      onGuardado()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!open || !usuario) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <div>
            <div className={styles.title}>Horarios de {usuario.nombre} {usuario.apellido}</div>
            <div className={styles.subtitle}>Definí bloques laborales por día. Podés tener varios bloques por día (ej: mañana y tarde).</div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.errorBox}>{error}</div>}
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)' }}>Cargando…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {DIAS.map(d => {
                const delDia = bloques.map((b, i) => ({ b, i })).filter(x => x.b.dia_semana === d.idx)
                return (
                  <div key={d.idx} style={{ border: '1px solid #E4DDD6', borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong style={{ fontSize: 13, color: '#2E2A24' }}>{d.label}</strong>
                      <button
                        type="button"
                        onClick={() => agregarBloque(d.idx)}
                        style={{ background: 'transparent', border: '1px solid #C8A882', color: '#A68660', borderRadius: 100, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}
                      >
                        + bloque
                      </button>
                    </div>

                    {delDia.length === 0 && (
                      <div style={{ fontSize: 12, color: '#A39990', fontStyle: 'italic' }}>Sin bloques (día no laboral)</div>
                    )}

                    {delDia.map(({ b, i }) => (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <input
                          type="time"
                          value={b.hora_inicio}
                          onChange={e => actualizar(i, { hora_inicio: e.target.value })}
                          style={inputStyle}
                        />
                        <span style={{ color: '#A39990', fontSize: 12 }}>a</span>
                        <input
                          type="time"
                          value={b.hora_fin}
                          onChange={e => actualizar(i, { hora_fin: e.target.value })}
                          style={inputStyle}
                        />
                        <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: '#5C544A', marginLeft: 'auto' }}>
                          <input
                            type="checkbox"
                            checked={b.activo}
                            onChange={e => actualizar(i, { activo: e.target.checked })}
                          />
                          Activo
                        </label>
                        <button
                          type="button"
                          onClick={() => eliminar(i)}
                          style={{ background: 'transparent', border: 'none', color: '#82331B', cursor: 'pointer', fontSize: 18, padding: 4 }}
                          title="Eliminar bloque"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className={styles.foot}>
          <button className={styles.btnGhost} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={guardar} disabled={saving || loading}>
            {saving ? 'Guardando…' : 'Guardar horarios'}
          </button>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #E4DDD6',
  borderRadius: 6,
  padding: '6px 8px',
  fontSize: 13,
  background: '#fff',
  color: '#2E2A24',
  fontFamily: 'ui-monospace, monospace',
}

function defaultBloques(): HorarioBloque[] {
  // Plantilla: Lun-Vie 9-18, Sab 9-13
  const lavi: HorarioBloque[] = [1, 2, 3, 4, 5].map(d => ({
    dia_semana: d, hora_inicio: '09:00', hora_fin: '18:00', activo: true,
  }))
  return [...lavi, { dia_semana: 6, hora_inicio: '09:00', hora_fin: '13:00', activo: true }]
}
