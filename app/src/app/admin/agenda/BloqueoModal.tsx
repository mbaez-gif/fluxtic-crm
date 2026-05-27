'use client'

import { useState } from 'react'
import { useCrearBloqueo, useProfesionales, useSedes } from '@/hooks/useApi'

interface Props {
  open: boolean
  onClose: () => void
}

export default function BloqueoModal({ open, onClose }: Props) {
  const [tipo, setTipo] = useState<'DIA_COMPLETO' | 'RANGO_HORARIO' | 'PROFESIONAL' | 'SEDE' | 'CONSULTORIO'>('PROFESIONAL')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [profesionalId, setProfesionalId] = useState('')
  const [sedeId, setSedeId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [cancelaTurnos, setCancelaTurnos] = useState(true)

  const profesionales = useProfesionales()
  const sedes = useSedes()
  const crear = useCrearBloqueo()

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!desde || !hasta || !motivo) {
      alert('Faltan campos requeridos')
      return
    }
    try {
      const result = await crear.mutateAsync({
        tipo,
        desde: new Date(desde).toISOString(),
        hasta: new Date(hasta).toISOString(),
        profesional_id: tipo === 'PROFESIONAL' ? profesionalId : null,
        sede_id: tipo === 'SEDE' ? sedeId : null,
        motivo,
        cancela_turnos: cancelaTurnos,
      }) as any
      if (result?.turnos_cancelados > 0) {
        alert(`Bloqueo creado. Se cancelaron ${result.turnos_cancelados} turnos afectados.`)
      }
      onClose()
    } catch (err: any) {
      alert(`Error: ${err?.message ?? 'no se pudo crear el bloqueo'}`)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 600 }}>Bloquear agenda</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <Field label="Tipo de bloqueo *">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} style={inputStyle}>
              <option value="PROFESIONAL">Por profesional (ej. vacaciones)</option>
              <option value="DIA_COMPLETO">Día completo (clínica cerrada)</option>
              <option value="RANGO_HORARIO">Rango horario (ej. reunión de staff)</option>
              <option value="SEDE">Por sede</option>
            </select>
          </Field>

          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Desde *">
              <input type="datetime-local" value={desde} onChange={(e) => setDesde(e.target.value)} required style={inputStyle} />
            </Field>
            <Field label="Hasta *">
              <input type="datetime-local" value={hasta} onChange={(e) => setHasta(e.target.value)} required style={inputStyle} />
            </Field>
          </div>

          {tipo === 'PROFESIONAL' && (
            <Field label="Profesional *">
              <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} required style={inputStyle}>
                <option value="">Seleccionar...</option>
                {profesionales.data?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.usuario.apellido}, {p.usuario.nombre}</option>
                ))}
              </select>
            </Field>
          )}

          {tipo === 'SEDE' && (
            <Field label="Sede *">
              <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} required style={inputStyle}>
                <option value="">Seleccionar...</option>
                {sedes.data?.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Field>
          )}

          <Field label="Motivo *">
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} required placeholder="ej. Licencia médica" style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10, background: 'var(--warning-l)', borderRadius: 8, fontSize: 13, color: 'var(--warning)' }}>
            <input type="checkbox" checked={cancelaTurnos} onChange={(e) => setCancelaTurnos(e.target.checked)} />
            Cancelar automáticamente los turnos afectados y avisar a los pacientes
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={crear.isPending} style={btnPrimary}>
              {crear.isPending ? 'Bloqueando...' : 'Crear bloqueo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14, flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)' }
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
