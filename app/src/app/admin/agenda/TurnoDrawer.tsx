'use client'

import Link from 'next/link'
import { useCambiarEstadoTurno, useCancelarTurno } from '@/hooks/useApi'
import { colorEstado, transicionesPermitidas, fmtFecha, fmtRango } from './agenda-utils'

interface Props {
  turno: any | null
  onClose: () => void
}

export default function TurnoDrawer({ turno, onClose }: Props) {
  const cambiarEstado = useCambiarEstadoTurno()
  const cancelar = useCancelarTurno()

  if (!turno) return null

  const estilo = colorEstado(turno.estado)
  const transiciones = transicionesPermitidas(turno.estado)

  async function handleEstado(nuevo: string) {
    try {
      await cambiarEstado.mutateAsync({ id: turno.id, estado: nuevo })
      onClose()
    } catch (err: any) {
      alert(err?.message ?? 'Error al cambiar estado')
    }
  }

  async function handleCancelar() {
    const motivo = window.prompt('Motivo de cancelación:')
    if (!motivo) return
    try {
      await cancelar.mutateAsync({ id: turno.id, motivo })
      onClose()
    } catch (err: any) {
      alert(err?.message ?? 'Error al cancelar')
    }
  }

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 50,
      }} />
      <aside style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
        background: 'var(--surface)', boxShadow: 'var(--shadow-lg)', zIndex: 51,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{
              padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: estilo.bg, color: estilo.fg, textTransform: 'uppercase', letterSpacing: '.04em',
            }}>{estilo.label}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)' }}>×</button>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--noir)', marginBottom: 4 }}>
            {turno.paciente.apellido}, {turno.paciente.nombre}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            DNI {turno.paciente.dni} {turno.paciente.telefono && `· ${turno.paciente.telefono}`}
          </div>
        </div>

        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          <Section titulo="Cita">
            <Row k="Fecha" v={fmtFecha(turno.fecha_hora, "EEEE d 'de' MMMM yyyy")} />
            <Row k="Horario" v={fmtRango(turno.fecha_hora, turno.duracion_min)} />
            <Row k="Modalidad" v={turno.modalidad === 'VIRTUAL' ? '📹 Virtual' : 'Presencial'} />
            <Row k="Sede" v={turno.sede?.nombre ?? '—'} />
            {turno.consultorio?.nombre && <Row k="Consultorio" v={turno.consultorio.nombre} />}
            <Row k="Prestación" v={turno.prestacion?.nombre ?? '—'} />
          </Section>

          <Section titulo="Profesional">
            <Row k="Médico/a" v={`${turno.profesional.usuario.apellido}, ${turno.profesional.usuario.nombre}`} />
            <Row k="Especialidad" v={turno.profesional.especialidad?.nombre ?? '—'} />
          </Section>

          {turno.motivo_consulta && (
            <Section titulo="Motivo de consulta">
              <div style={{ fontSize: 13, color: 'var(--noir)', whiteSpace: 'pre-wrap' }}>{turno.motivo_consulta}</div>
            </Section>
          )}

          {turno.mensaje_interno && (
            <Section titulo="🔒 Mensaje interno del equipo" color="var(--warning)">
              <div style={{ fontSize: 13, color: 'var(--noir)', whiteSpace: 'pre-wrap' }}>{turno.mensaje_interno}</div>
            </Section>
          )}

          {turno.sobreturno && (
            <div style={{ padding: 10, background: 'var(--warning-l)', color: 'var(--warning)', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
              ⚠ Sobreturno
            </div>
          )}

          {turno.modalidad === 'VIRTUAL' && turno.videoconsulta_url && (
            <Section titulo="Videoconsulta">
              <a href={turno.videoconsulta_url} target="_blank" rel="noreferrer" style={{
                display: 'inline-block', padding: '10px 14px', background: 'var(--teal)', color: '#fff',
                borderRadius: 8, fontSize: 13, fontWeight: 500,
              }}>📹 Abrir sala</a>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                {turno.videoconsulta_proveedor} · {turno.videoconsulta_estado ?? 'pendiente'}
              </div>
            </Section>
          )}

          {turno.requiere_copago && (
            <Section titulo="Copago">
              <Row k="Monto" v={`$${Number(turno.monto_copago ?? 0).toLocaleString('es-AR')}`} />
              <Row k="Método" v={turno.metodo_copago} />
              {turno.mp_init_point && (
                <a href={turno.mp_init_point} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--teal)' }}>
                  Abrir link de Mercado Pago →
                </a>
              )}
            </Section>
          )}

          <Section titulo="Acciones">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link href={`/admin/pacientes/${turno.paciente.id}`} style={{
                padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 13,
                color: 'var(--noir)', textAlign: 'center',
              }}>Ver ficha del paciente</Link>
              <Link href={`/admin/historia-clinica/paciente/${turno.paciente.id}`} style={{
                padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 13,
                color: 'var(--noir)', textAlign: 'center',
              }}>Abrir historia clínica</Link>
            </div>
          </Section>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
          {transiciones.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: cancelar.isPending || cambiarEstado.isPending ? 0 : 8 }}>
              {transiciones.map((t) => (
                <button
                  key={t.estado}
                  onClick={() => t.estado === 'CANCELADO' ? handleCancelar() : handleEstado(t.estado)}
                  disabled={cambiarEstado.isPending}
                  style={{
                    flex: 1, minWidth: 120, padding: '10px 12px',
                    background: t.estado === 'CANCELADO' ? 'var(--danger-l)' : t.estado === 'ATENDIDO' ? 'var(--salud)' : 'var(--teal)',
                    color: t.estado === 'CANCELADO' ? 'var(--danger)' : '#fff',
                    border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={onClose} style={{
            width: '100%', padding: '10px', background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 8, fontSize: 13, color: 'var(--muted)',
          }}>Cerrar</button>
        </div>
      </aside>
    </>
  )
}

function Section({ titulo, children, color }: { titulo: string; children: React.ReactNode; color?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: color ?? 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
        {titulo}
      </div>
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
