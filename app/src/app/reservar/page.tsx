'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  useEspecialidades, useProfesionales, usePrestaciones, useSedes,
  useDisponibilidad, useConfigPublica, useCrearReservaPublica,
} from '@/hooks/useApi'

type Paso = 1 | 2 | 3 | 4 | 5

export default function ReservarTurnoPage() {
  const [paso, setPaso] = useState<Paso>(1)
  const [especialidadId, setEspecialidadId] = useState('')
  const [profesionalId, setProfesionalId] = useState('')
  const [prestacionId, setPrestacionId] = useState('')
  const [sedeId, setSedeId] = useState('')
  const [coberturaTexto, setCoberturaTexto] = useState('Particular')
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date | null>(null)
  const [slotSeleccionado, setSlotSeleccionado] = useState<{ inicio: string; profesional_id: string; profesional_nombre: string } | null>(null)
  const [datos, setDatos] = useState({ dni: '', nombre: '', apellido: '', telefono: '', email: '' })
  const [resultado, setResultado] = useState<any>(null)

  const config = useConfigPublica()
  const especialidades = useEspecialidades()
  const profesionales = useProfesionales(especialidadId || undefined)
  const prestaciones = usePrestaciones(especialidadId || undefined)
  const sedes = useSedes()
  const crear = useCrearReservaPublica()

  const desdeISO = fechaSeleccionada ? fechaSeleccionada.toISOString() : ''
  const hastaISO = fechaSeleccionada ? new Date(fechaSeleccionada.getTime() + 14 * 24 * 3600 * 1000).toISOString() : ''
  const dispo = useDisponibilidad({
    prestacion_id: prestacionId,
    profesional_id: profesionalId || undefined,
    sede_id: sedeId || undefined,
    especialidad_id: especialidadId || undefined,
    fecha_desde: desdeISO,
    fecha_hasta: hastaISO,
  })

  async function confirmar() {
    if (!slotSeleccionado || !sedeId) return
    try {
      const res: any = await crear.mutateAsync({
        prestacion_id: prestacionId,
        profesional_id: slotSeleccionado.profesional_id,
        sede_id: sedeId,
        fecha_hora: slotSeleccionado.inicio,
        modalidad: 'PRESENCIAL',
        motivo_consulta: null,
        paciente: { ...datos },
      })
      setResultado(res)
      setPaso(5)
    } catch (e: any) {
      alert(`Error al reservar: ${e?.message ?? 'no se pudo confirmar'}`)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '40px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="18" rx="1.5" />
              <rect x="3" y="9" width="18" height="6" rx="1.5" />
            </svg>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--noir)' }}>{config.data?.clinica?.nombre ?? 'Fluxtic Salud'}</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: 'var(--noir)', marginBottom: 6 }}>Reservá tu turno online</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Atención profesional · Turnos confirmados al instante</p>
        </div>

        <Pasos paso={paso} />

        {paso === 1 && (
          <Card>
            <h2 style={titulo}>1 · Especialidad y prestación</h2>
            <Field label="Especialidad *">
              <select value={especialidadId} onChange={(e) => { setEspecialidadId(e.target.value); setProfesionalId(''); setPrestacionId('') }} style={input}>
                <option value="">Seleccionar especialidad...</option>
                {especialidades.data?.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </Field>
            <Field label="Prestación *">
              <select value={prestacionId} onChange={(e) => setPrestacionId(e.target.value)} disabled={!especialidadId} style={input}>
                <option value="">Seleccionar prestación...</option>
                {prestaciones.data?.map((p: any) => <option key={p.id} value={p.id}>{p.nombre} · ${Number(p.precio_particular).toLocaleString('es-AR')}</option>)}
              </select>
            </Field>
            <Field label="Cobertura">
              <select value={coberturaTexto} onChange={(e) => setCoberturaTexto(e.target.value)} style={input}>
                <option value="Particular">Particular</option>
                <option value="OSDE">OSDE</option>
                <option value="Swiss Medical">Swiss Medical</option>
                <option value="Galeno">Galeno</option>
                <option value="OTRA">Otra</option>
              </select>
            </Field>
            <Field label="Profesional (opcional, sino lo elegimos)">
              <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} disabled={!especialidadId} style={input}>
                <option value="">Cualquier profesional disponible</option>
                {profesionales.data?.map((p: any) => <option key={p.id} value={p.id}>{p.usuario.apellido}, {p.usuario.nombre}</option>)}
              </select>
            </Field>
            <Field label="Sede *">
              <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} style={input}>
                <option value="">Seleccionar sede...</option>
                {sedes.data?.map((s: any) => <option key={s.id} value={s.id}>{s.nombre} {s.direccion && `· ${s.direccion}`}</option>)}
              </select>
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setPaso(2)} disabled={!especialidadId || !prestacionId || !sedeId} style={btnPrimary}>Continuar →</button>
            </div>
          </Card>
        )}

        {paso === 2 && (
          <Card>
            <h2 style={titulo}>2 · Elegí día y horario</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {[0, 1, 2, 3, 4, 5, 6].map((delta) => {
                const d = new Date()
                d.setDate(d.getDate() + delta); d.setHours(0, 0, 0, 0)
                const sel = fechaSeleccionada?.toDateString() === d.toDateString()
                return (
                  <button key={delta} onClick={() => setFechaSeleccionada(d)} style={{
                    padding: '10px 14px', borderRadius: 8,
                    border: sel ? '2px solid var(--teal)' : '1px solid var(--border)',
                    background: sel ? 'var(--teal-l)' : 'var(--surface)',
                    color: sel ? 'var(--teal-d)' : 'var(--noir)',
                    fontWeight: sel ? 600 : 400, fontSize: 12, cursor: 'pointer',
                  }}>
                    {format(d, 'EEE d/MM', { locale: es })}
                  </button>
                )
              })}
            </div>

            {fechaSeleccionada ? (
              dispo.isLoading ? <Empty texto="Buscando disponibilidad..." /> :
              (dispo.data?.por_profesional ?? []).length === 0 ? <Empty texto="Sin horarios disponibles este día. Probá otra fecha." /> : (
                <div>
                  {dispo.data.por_profesional.map((p: any) => {
                    const slotsDia = p.slots.filter((s: any) => new Date(s.inicio).toDateString() === fechaSeleccionada.toDateString())
                    if (slotsDia.length === 0) return null
                    return (
                      <div key={p.profesional_id} style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
                          {p.profesional_nombre}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {slotsDia.slice(0, 20).map((s: any) => {
                            const isSelected = slotSeleccionado?.inicio === s.inicio && slotSeleccionado?.profesional_id === p.profesional_id
                            return (
                              <button key={s.inicio} onClick={() => setSlotSeleccionado({ inicio: s.inicio, profesional_id: p.profesional_id, profesional_nombre: p.profesional_nombre })} style={{
                                padding: '8px 12px', borderRadius: 6,
                                border: isSelected ? '2px solid var(--teal)' : '1px solid var(--border)',
                                background: isSelected ? 'var(--teal-l)' : 'var(--surface)',
                                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                              }}>
                                {format(new Date(s.inicio), 'HH:mm')}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : <Empty texto="Elegí un día arriba" />}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => setPaso(1)} style={btnSecondary}>← Atrás</button>
              <button onClick={() => setPaso(3)} disabled={!slotSeleccionado} style={btnPrimary}>Continuar →</button>
            </div>
          </Card>
        )}

        {paso === 3 && (
          <Card>
            <h2 style={titulo}>3 · Tus datos</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="DNI *"><input value={datos.dni} onChange={(e) => setDatos({ ...datos, dni: e.target.value })} required style={input} /></Field>
              <Field label="Teléfono *"><input value={datos.telefono} onChange={(e) => setDatos({ ...datos, telefono: e.target.value })} required placeholder="+54 9 11 ..." style={input} /></Field>
              <Field label="Nombre *"><input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} required style={input} /></Field>
              <Field label="Apellido *"><input value={datos.apellido} onChange={(e) => setDatos({ ...datos, apellido: e.target.value })} required style={input} /></Field>
              <div style={{ gridColumn: 'span 2' }}>
                <Field label="Email *"><input type="email" value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} required style={input} /></Field>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => setPaso(2)} style={btnSecondary}>← Atrás</button>
              <button onClick={() => setPaso(4)} disabled={!datos.dni || !datos.nombre || !datos.apellido || !datos.telefono || !datos.email} style={btnPrimary}>Continuar →</button>
            </div>
          </Card>
        )}

        {paso === 4 && (
          <Card>
            <h2 style={titulo}>4 · Confirmá tu turno</h2>
            <Resumen
              prestacion={prestaciones.data?.find((p: any) => p.id === prestacionId)?.nombre}
              profesional={slotSeleccionado?.profesional_nombre}
              sede={sedes.data?.find((s: any) => s.id === sedeId)?.nombre}
              fecha_hora={slotSeleccionado?.inicio}
              cobertura={coberturaTexto}
              paciente={datos}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button onClick={() => setPaso(3)} style={btnSecondary}>← Atrás</button>
              <button onClick={confirmar} disabled={crear.isPending} style={btnPrimary}>
                {crear.isPending ? 'Confirmando...' : '✓ Confirmar turno'}
              </button>
            </div>
          </Card>
        )}

        {paso === 5 && resultado && (
          <Card>
            <div style={{ textAlign: 'center', padding: 20 }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
              <h2 style={{ fontSize: 22, fontWeight: 600, color: 'var(--salud)', marginBottom: 8 }}>¡Turno reservado!</h2>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
                Te vamos a enviar la confirmación por WhatsApp y email.
              </p>
              {resultado.requiere_pago && resultado.init_point && (
                <div style={{ marginTop: 16, padding: 16, background: 'var(--warning-l)', borderRadius: 8 }}>
                  <p style={{ fontSize: 13, color: 'var(--warning)', marginBottom: 10 }}>
                    Para confirmar tu turno necesitamos el pago de seña: <strong>${Number(resultado.monto_copago).toLocaleString('es-AR')}</strong>
                  </p>
                  <a href={resultado.init_point} target="_blank" rel="noreferrer" style={{ ...btnPrimary, display: 'inline-block', textDecoration: 'none' }}>
                    Pagar con Mercado Pago →
                  </a>
                </div>
              )}
              <p style={{ marginTop: 20, fontSize: 11, color: 'var(--muted)' }}>
                ID de turno: <code style={{ fontFamily: 'var(--font-m)' }}>{resultado.turno_id?.slice(-8).toUpperCase()}</code>
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function Pasos({ paso }: { paso: Paso }) {
  const pasos = ['Especialidad', 'Horario', 'Datos', 'Confirmar', 'Listo']
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 20 }}>
      {pasos.map((label, i) => {
        const n = (i + 1) as Paso
        const active = n === paso
        const done = n < paso
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: done ? 'var(--salud)' : active ? 'var(--teal)' : 'var(--bg-2)',
              color: done || active ? '#fff' : 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 600,
            }}>{done ? '✓' : i + 1}</div>
            {i < pasos.length - 1 && <div style={{ width: 30, height: 2, background: done ? 'var(--salud)' : 'var(--bg-2)' }} />}
          </div>
        )
      })}
    </div>
  )
}

function Resumen({ prestacion, profesional, sede, fecha_hora, cobertura, paciente }: any) {
  return (
    <div style={{ background: 'var(--bg-2)', padding: 16, borderRadius: 10 }}>
      <Row k="Prestación" v={prestacion ?? '—'} />
      <Row k="Profesional" v={profesional ?? '—'} />
      <Row k="Sede" v={sede ?? '—'} />
      <Row k="Fecha y hora" v={fecha_hora ? format(new Date(fecha_hora), "EEEE d 'de' MMMM HH:mm", { locale: es }) : '—'} />
      <Row k="Cobertura" v={cobertura} />
      <Row k="Paciente" v={`${paciente.apellido}, ${paciente.nombre} · DNI ${paciente.dni}`} />
      <Row k="Contacto" v={`${paciente.telefono} · ${paciente.email}`} />
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, boxShadow: 'var(--shadow-sm)' }}>{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid var(--border-2)' }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <span style={{ color: 'var(--noir)', fontWeight: 500, textAlign: 'right' }}>{v}</span>
    </div>
  )
}
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }

const titulo: React.CSSProperties = { fontSize: 16, fontWeight: 600, color: 'var(--noir)', marginBottom: 18 }
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)' }
const btnPrimary: React.CSSProperties = { padding: '10px 22px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 22px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, cursor: 'pointer' }
