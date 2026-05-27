'use client'

import { useState } from 'react'
import { useBuscarPacientes, useCrearTurno, useEspecialidades, usePrestaciones, useProfesionales, useSedes } from '@/hooks/useApi'

interface Props {
  open: boolean
  fechaInicial?: Date
  profesionalInicial?: string
  onClose: () => void
}

export default function NuevoTurnoModal({ open, fechaInicial, profesionalInicial, onClose }: Props) {
  const [pacienteId, setPacienteId] = useState('')
  const [pacienteLabel, setPacienteLabel] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [especialidadId, setEspecialidadId] = useState('')
  const [profesionalId, setProfesionalId] = useState(profesionalInicial ?? '')
  const [prestacionId, setPrestacionId] = useState('')
  const [sedeId, setSedeId] = useState('')
  const [fecha, setFecha] = useState(fechaInicial ? fmtForInput(fechaInicial) : fmtForInput(new Date()))
  const [modalidad, setModalidad] = useState<'PRESENCIAL' | 'VIRTUAL'>('PRESENCIAL')
  const [sobreturno, setSobreturno] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [mensajeInterno, setMensajeInterno] = useState('')

  const pacientesQuery = useBuscarPacientes(busqueda)
  const especialidades = useEspecialidades()
  const profesionales = useProfesionales(especialidadId || undefined)
  const prestaciones = usePrestaciones(especialidadId || undefined)
  const sedes = useSedes()
  const crearTurno = useCrearTurno()

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pacienteId || !profesionalId || !sedeId || !fecha) {
      alert('Faltan campos requeridos')
      return
    }
    try {
      await crearTurno.mutateAsync({
        paciente_id: pacienteId,
        profesional_id: profesionalId,
        prestacion_id: prestacionId || null,
        sede_id: sedeId,
        fecha_hora: new Date(fecha).toISOString(),
        modalidad,
        sobreturno,
        motivo_consulta: motivo || null,
      })
      onClose()
    } catch (err: any) {
      alert(`Error: ${err?.message ?? 'no se pudo crear el turno'}`)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 580, maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--noir)' }}>Nuevo turno</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)' }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24 }}>
          <Label>Paciente</Label>
          {pacienteId ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--teal-l)', borderRadius: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: 'var(--teal-d)', fontWeight: 500 }}>{pacienteLabel}</span>
              <button type="button" onClick={() => { setPacienteId(''); setPacienteLabel(''); setBusqueda('') }} style={{ background: 'none', border: 'none', color: 'var(--teal-d)', fontSize: 12, cursor: 'pointer' }}>cambiar</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Buscar por DNI, apellido o nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={inputStyle}
              />
              {busqueda.length >= 2 && pacientesQuery.data && pacientesQuery.data.data.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, marginBottom: 14, maxHeight: 200, overflowY: 'auto' }}>
                  {pacientesQuery.data.data.slice(0, 10).map((p: any) => (
                    <div
                      key={p.id}
                      onClick={() => { setPacienteId(p.id); setPacienteLabel(`${p.apellido}, ${p.nombre} · DNI ${p.dni}`) }}
                      style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-2)', cursor: 'pointer', fontSize: 13 }}
                    >
                      {p.apellido}, {p.nombre} <span style={{ color: 'var(--muted)' }}>· {p.dni}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <Row>
            <Field label="Especialidad (opcional)">
              <select value={especialidadId} onChange={(e) => { setEspecialidadId(e.target.value); setProfesionalId(''); setPrestacionId('') }} style={inputStyle}>
                <option value="">Todas</option>
                {especialidades.data?.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
            <Field label="Profesional *">
              <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} required style={inputStyle}>
                <option value="">Seleccionar...</option>
                {profesionales.data?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.usuario.apellido}, {p.usuario.nombre} · {p.especialidad.nombre}</option>
                ))}
              </select>
            </Field>
          </Row>

          <Row>
            <Field label="Prestación">
              <select value={prestacionId} onChange={(e) => setPrestacionId(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar...</option>
                {prestaciones.data?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.nombre} ({p.duracion_min} min)</option>
                ))}
              </select>
            </Field>
            <Field label="Sede *">
              <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} required style={inputStyle}>
                <option value="">Seleccionar...</option>
                {sedes.data?.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </Field>
          </Row>

          <Row>
            <Field label="Fecha y hora *">
              <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} required style={inputStyle} />
            </Field>
            <Field label="Modalidad">
              <select value={modalidad} onChange={(e) => setModalidad(e.target.value as any)} style={inputStyle}>
                <option value="PRESENCIAL">Presencial</option>
                <option value="VIRTUAL">📹 Virtual (telemedicina)</option>
              </select>
            </Field>
          </Row>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 13 }}>
            <input type="checkbox" checked={sobreturno} onChange={(e) => setSobreturno(e.target.checked)} />
            Sobreturno (permite chocar con horario ocupado)
          </label>

          <Field label="Motivo de consulta">
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          <Field label="Mensaje interno del equipo (no visible al paciente)">
            <textarea value={mensajeInterno} onChange={(e) => setMensajeInterno(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={crearTurno.isPending} style={btnPrimary}>
              {crearTurno.isPending ? 'Creando...' : 'Crear turno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 14, flex: 1 }}><Label>{label}</Label>{children}</div>
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 12 }}>{children}</div>
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)' }
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }

function fmtForInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
