'use client'

import { useMemo, useState } from 'react'
import { addDays, differenceInMinutes } from 'date-fns'
import {
  useTurnos, useProfesionales, useSedes, useEspecialidades, useBloqueos,
} from '@/hooks/useApi'
import {
  HORA_INICIO, HORA_FIN, SLOT_MIN, diasSemana, fmtFecha, fmtHora,
  rangoVista, colorEstado, type VistaAgenda,
} from './agenda-utils'
import TurnoDrawer from './TurnoDrawer'
import NuevoTurnoModal from './NuevoTurnoModal'
import BloqueoModal from './BloqueoModal'

export default function AgendaPage() {
  const [fechaActual, setFechaActual] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [vista, setVista] = useState<VistaAgenda>('semana')
  const [profesionalId, setProfesionalId] = useState('')
  const [sedeId, setSedeId] = useState('')
  const [especialidadId, setEspecialidadId] = useState('')
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<any | null>(null)
  const [showNuevoTurno, setShowNuevoTurno] = useState(false)
  const [showBloqueo, setShowBloqueo] = useState(false)
  const [slotInicial, setSlotInicial] = useState<Date | undefined>()

  const rango = rangoVista(fechaActual, vista)
  const turnosQuery = useTurnos({
    desde: rango.desde.toISOString(),
    hasta: rango.hasta.toISOString(),
    profesional_id: profesionalId || undefined,
    sede_id: sedeId || undefined,
  })
  const bloqueosQuery = useBloqueos(rango.desde.toISOString(), rango.hasta.toISOString(), {
    profesional_id: profesionalId || undefined,
    sede_id: sedeId || undefined,
  })
  const profesionales = useProfesionales(especialidadId || undefined)
  const sedes = useSedes()
  const especialidades = useEspecialidades()

  const turnos = turnosQuery.data ?? []
  const bloqueos = bloqueosQuery.data ?? []
  const dias = useMemo(() => diasSemana(fechaActual), [fechaActual])

  function avanzar(delta: number) {
    setFechaActual((d) => {
      if (vista === 'dia') return addDays(d, delta)
      if (vista === 'semana') return addDays(d, delta * 7)
      return addDays(d, delta * 30)
    })
  }

  function tituloVista(): string {
    if (vista === 'dia') return fmtFecha(fechaActual, "EEEE d 'de' MMMM yyyy")
    if (vista === 'semana') return `${fmtFecha(dias[0], 'd MMM')} – ${fmtFecha(dias[6], "d MMM yyyy")}`
    return fmtFecha(fechaActual, 'MMMM yyyy')
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--top-h))' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--noir)', marginBottom: 2 }}>Agenda médica</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{tituloVista()}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowBloqueo(true)} style={btnSecondary}>⛔ Bloquear</button>
          <button onClick={() => { setSlotInicial(undefined); setShowNuevoTurno(true) }} style={btnPrimary}>+ Nuevo turno</button>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: 3, borderRadius: 8 }}>
          <button onClick={() => avanzar(-1)} style={navBtn}>‹</button>
          <button onClick={() => setFechaActual(new Date(new Date().setHours(0, 0, 0, 0)))} style={navBtn}>Hoy</button>
          <button onClick={() => avanzar(1)} style={navBtn}>›</button>
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: 3, borderRadius: 8 }}>
          {(['dia', 'semana', 'mes'] as VistaAgenda[]).map((v) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              style={{
                ...navBtn,
                background: vista === v ? 'var(--surface)' : 'transparent',
                color: vista === v ? 'var(--noir)' : 'var(--muted)',
                fontWeight: vista === v ? 600 : 400,
              }}
            >
              {v === 'dia' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>

        <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} style={filterStyle}>
          <option value="">Todos los profesionales</option>
          {profesionales.data?.map((p: any) => (
            <option key={p.id} value={p.id}>{p.usuario.apellido}, {p.usuario.nombre}</option>
          ))}
        </select>

        <select value={especialidadId} onChange={(e) => setEspecialidadId(e.target.value)} style={filterStyle}>
          <option value="">Todas las especialidades</option>
          {especialidades.data?.map((e: any) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>

        <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} style={filterStyle}>
          <option value="">Todas las sedes</option>
          {sedes.data?.map((s: any) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>

        {turnosQuery.isFetching && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Actualizando...</span>}
      </div>

      {/* Calendario */}
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)' }}>
        {vista === 'semana' && (
          <CalendarioSemana
            dias={dias}
            turnos={turnos}
            bloqueos={bloqueos}
            onTurnoClick={setTurnoSeleccionado}
            onSlotClick={(d) => { setSlotInicial(d); setShowNuevoTurno(true) }}
          />
        )}
        {vista === 'dia' && (
          <CalendarioDia
            fecha={fechaActual}
            turnos={turnos}
            bloqueos={bloqueos}
            profesionales={profesionales.data ?? []}
            profesionalFiltrado={profesionalId}
            onTurnoClick={setTurnoSeleccionado}
            onSlotClick={(d) => { setSlotInicial(d); setShowNuevoTurno(true) }}
          />
        )}
        {vista === 'mes' && (
          <CalendarioMes
            fecha={fechaActual}
            turnos={turnos}
            onTurnoClick={setTurnoSeleccionado}
            onDiaClick={(d) => { setFechaActual(d); setVista('dia') }}
          />
        )}
      </div>

      {/* Drawer + Modales */}
      <TurnoDrawer turno={turnoSeleccionado} onClose={() => setTurnoSeleccionado(null)} />
      <NuevoTurnoModal open={showNuevoTurno} fechaInicial={slotInicial} onClose={() => setShowNuevoTurno(false)} />
      <BloqueoModal open={showBloqueo} onClose={() => setShowBloqueo(false)} />
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Vista Semana
// ════════════════════════════════════════════════════════════════

function CalendarioSemana({
  dias, turnos, bloqueos, onTurnoClick, onSlotClick,
}: {
  dias: Date[]
  turnos: any[]
  bloqueos: any[]
  onTurnoClick: (t: any) => void
  onSlotClick: (d: Date) => void
}) {
  const horas = useMemo(() => {
    const out: number[] = []
    for (let h = HORA_INICIO; h < HORA_FIN; h++) out.push(h)
    return out
  }, [])

  const ALTO_HORA = 60 // px

  function turnosDeDia(dia: Date) {
    return turnos.filter((t) => {
      const td = new Date(t.fecha_hora)
      return td.getFullYear() === dia.getFullYear() && td.getMonth() === dia.getMonth() && td.getDate() === dia.getDate()
    })
  }

  function bloqueosDeDia(dia: Date) {
    return bloqueos.filter((b) => {
      const desde = new Date(b.desde), hasta = new Date(b.hasta)
      const ini = new Date(dia); ini.setHours(HORA_INICIO, 0, 0)
      const fin = new Date(dia); fin.setHours(HORA_FIN, 0, 0)
      return desde < fin && hasta > ini
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(7, 1fr)', minWidth: 800 }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} />
      {dias.map((d, i) => {
        const esHoy = d.toDateString() === new Date().toDateString()
        return (
          <div key={i} style={{
            position: 'sticky', top: 0, zIndex: 2, padding: '8px 6px',
            background: esHoy ? 'var(--teal-l)' : 'var(--surface)',
            borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: esHoy ? 'var(--teal-d)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>
              {fmtFecha(d, 'EEE')}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: esHoy ? 'var(--teal-d)' : 'var(--noir)' }}>
              {fmtFecha(d, 'd')}
            </div>
          </div>
        )
      })}

      {/* Body */}
      {horas.map((h) => (
        <Fragment key={h}>
          <div style={{
            borderBottom: '1px solid var(--border-2)', borderRight: '1px solid var(--border)',
            height: ALTO_HORA, padding: '4px 8px',
            fontSize: 11, color: 'var(--muted)', textAlign: 'right',
          }}>{String(h).padStart(2, '0')}:00</div>

          {dias.map((d, i) => {
            const slotInicio = new Date(d); slotInicio.setHours(h, 0, 0, 0)
            const slotFin = new Date(d); slotFin.setHours(h + 1, 0, 0, 0)
            const tDia = turnosDeDia(d)
            const tEnHora = tDia.filter((t) => {
              const td = new Date(t.fecha_hora)
              return td.getHours() === h
            })
            const bDia = bloqueosDeDia(d).filter((b) => {
              const bDesde = new Date(b.desde), bHasta = new Date(b.hasta)
              return bDesde < slotFin && bHasta > slotInicio
            })

            return (
              <div
                key={i}
                onClick={() => onSlotClick(slotInicio)}
                style={{
                  borderBottom: '1px solid var(--border-2)', borderRight: '1px solid var(--border)',
                  height: ALTO_HORA, position: 'relative', cursor: 'pointer',
                  background: bDia.length > 0 ? 'rgba(220,38,38,.05)' : 'transparent',
                }}
              >
                {bDia.map((b) => (
                  <div key={b.id} title={b.motivo} style={{
                    position: 'absolute', left: 2, right: 2, top: 2, bottom: 2,
                    background: 'repeating-linear-gradient(45deg, rgba(220,38,38,.1), rgba(220,38,38,.1) 6px, transparent 6px, transparent 12px)',
                    border: '1px dashed var(--danger)', borderRadius: 4,
                    fontSize: 10, color: 'var(--danger)', padding: '2px 4px', overflow: 'hidden',
                    pointerEvents: 'none',
                  }}>
                    {b.motivo}
                  </div>
                ))}
                {tEnHora.map((t) => {
                  const td = new Date(t.fecha_hora)
                  const offsetMin = td.getMinutes()
                  const altoMin = t.duracion_min
                  const estilo = colorEstado(t.estado)
                  return (
                    <div
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); onTurnoClick(t) }}
                      style={{
                        position: 'absolute',
                        top: (offsetMin / 60) * ALTO_HORA + 2,
                        left: 2, right: 2,
                        height: Math.max(20, (altoMin / 60) * ALTO_HORA - 4),
                        background: estilo.bg,
                        borderLeft: `3px solid ${estilo.border}`,
                        borderRadius: 4, padding: '4px 6px', overflow: 'hidden',
                        fontSize: 11, cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: estilo.fg, lineHeight: 1.2 }}>
                        {fmtHora(t.fecha_hora)} {t.paciente.apellido}
                      </div>
                      <div style={{ color: estilo.fg, opacity: .8, fontSize: 10, lineHeight: 1.2 }}>
                        {t.profesional.usuario.apellido} · {t.prestacion?.nombre ?? 'Consulta'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Vista Día — columnas por profesional
// ════════════════════════════════════════════════════════════════

function CalendarioDia({
  fecha, turnos, bloqueos, profesionales, profesionalFiltrado, onTurnoClick, onSlotClick,
}: {
  fecha: Date
  turnos: any[]
  bloqueos: any[]
  profesionales: any[]
  profesionalFiltrado: string
  onTurnoClick: (t: any) => void
  onSlotClick: (d: Date) => void
}) {
  const profsVisibles = profesionalFiltrado
    ? profesionales.filter((p) => p.id === profesionalFiltrado)
    : profesionales.filter((p) => turnos.some((t) => t.profesional.id === p.id)) // solo los que tienen turnos hoy

  const profsAMostrar = profsVisibles.length > 0 ? profsVisibles : profesionales.slice(0, 6)

  const horas: number[] = []
  for (let h = HORA_INICIO; h < HORA_FIN; h++) horas.push(h)
  const ALTO_HORA = 60

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `60px repeat(${profsAMostrar.length}, 1fr)`, minWidth: 800 }}>
      <div style={{ position: 'sticky', top: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)' }} />
      {profsAMostrar.map((p: any) => (
        <div key={p.id} style={{
          position: 'sticky', top: 0, background: 'var(--surface)', padding: '10px 12px',
          borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--noir)' }}>{p.usuario.apellido}, {p.usuario.nombre}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{p.especialidad?.nombre}</div>
        </div>
      ))}
      {horas.map((h) => (
        <Fragment key={h}>
          <div style={{ borderBottom: '1px solid var(--border-2)', borderRight: '1px solid var(--border)', height: ALTO_HORA, padding: '4px 8px', fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
            {String(h).padStart(2, '0')}:00
          </div>
          {profsAMostrar.map((p: any) => {
            const slotInicio = new Date(fecha); slotInicio.setHours(h, 0, 0, 0)
            const tEnHora = turnos.filter((t) => {
              if (t.profesional.id !== p.id) return false
              const td = new Date(t.fecha_hora)
              return td.getDate() === fecha.getDate() && td.getMonth() === fecha.getMonth() && td.getHours() === h
            })
            return (
              <div key={p.id} onClick={() => onSlotClick(slotInicio)} style={{
                borderBottom: '1px solid var(--border-2)', borderRight: '1px solid var(--border)',
                height: ALTO_HORA, position: 'relative', cursor: 'pointer',
              }}>
                {tEnHora.map((t) => {
                  const td = new Date(t.fecha_hora)
                  const estilo = colorEstado(t.estado)
                  return (
                    <div
                      key={t.id}
                      onClick={(e) => { e.stopPropagation(); onTurnoClick(t) }}
                      style={{
                        position: 'absolute',
                        top: (td.getMinutes() / 60) * ALTO_HORA + 2,
                        left: 4, right: 4,
                        height: Math.max(28, (t.duracion_min / 60) * ALTO_HORA - 4),
                        background: estilo.bg, borderLeft: `3px solid ${estilo.border}`, borderRadius: 4,
                        padding: '4px 8px', overflow: 'hidden', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: estilo.fg }}>{fmtHora(t.fecha_hora)} {t.paciente.apellido}, {t.paciente.nombre}</div>
                      <div style={{ color: estilo.fg, opacity: .7, fontSize: 11 }}>{t.prestacion?.nombre ?? 'Consulta'}</div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Vista Mes — grid clásico
// ════════════════════════════════════════════════════════════════

function CalendarioMes({
  fecha, turnos, onTurnoClick, onDiaClick,
}: {
  fecha: Date
  turnos: any[]
  onTurnoClick: (t: any) => void
  onDiaClick: (d: Date) => void
}) {
  const primerDiaMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1)
  const primerDiaSemana = (primerDiaMes.getDay() + 6) % 7  // 0=Lun
  const diasEnMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate()
  const filas = Math.ceil((primerDiaSemana + diasEnMes) / 7)
  const celdas: (Date | null)[] = []
  for (let i = 0; i < primerDiaSemana; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(new Date(fecha.getFullYear(), fecha.getMonth(), d))
  while (celdas.length < filas * 7) celdas.push(null)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} style={{ padding: '10px 8px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '.05em' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(110px, 1fr)' }}>
        {celdas.map((d, i) => {
          if (!d) return <div key={i} style={{ background: 'var(--bg-2)', borderRight: '1px solid var(--border-2)', borderBottom: '1px solid var(--border-2)' }} />
          const tDia = turnos.filter((t) => {
            const td = new Date(t.fecha_hora)
            return td.getDate() === d.getDate() && td.getMonth() === d.getMonth()
          })
          const esHoy = d.toDateString() === new Date().toDateString()
          return (
            <div key={i} onClick={() => onDiaClick(d)} style={{
              borderRight: '1px solid var(--border-2)', borderBottom: '1px solid var(--border-2)',
              padding: 6, cursor: 'pointer',
              background: esHoy ? 'var(--teal-l)' : 'transparent',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: esHoy ? 'var(--teal-d)' : 'var(--noir)', marginBottom: 4 }}>
                {d.getDate()}
              </div>
              {tDia.slice(0, 3).map((t) => {
                const estilo = colorEstado(t.estado)
                return (
                  <div
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); onTurnoClick(t) }}
                    style={{
                      fontSize: 10, padding: '2px 4px', marginBottom: 2,
                      background: estilo.bg, color: estilo.fg, borderRadius: 3,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {fmtHora(t.fecha_hora)} {t.paciente.apellido}
                  </div>
                )
              })}
              {tDia.length > 3 && (
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>+{tDia.length - 3} más</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: 'var(--noir)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
const navBtn: React.CSSProperties = { padding: '6px 12px', background: 'transparent', border: 'none', borderRadius: 6, fontSize: 13, color: 'var(--noir)', cursor: 'pointer' }
const filterStyle: React.CSSProperties = { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)' }
