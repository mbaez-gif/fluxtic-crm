'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePortalMisTurnos } from '@/hooks/useApi'

export default function PortalTurnosPage() {
  const { data: turnos, isLoading, error } = usePortalMisTurnos()
  const ahora = new Date()
  const proximos = (turnos ?? []).filter((t: any) => new Date(t.fecha_hora) >= ahora)
  const pasados = (turnos ?? []).filter((t: any) => new Date(t.fecha_hora) < ahora).slice(0, 10)

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6, color: 'var(--noir)' }}>Mis turnos</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        Próximos turnos confirmados y pendientes en la clínica.
      </p>

      {isLoading && <Empty texto="Cargando..." />}
      {error && <ErrorBanner texto={(error as any)?.message ?? 'No se pudieron cargar los turnos'} />}

      {turnos && (
        <>
          <Section titulo={`Próximos (${proximos.length})`}>
            {proximos.length === 0 ? (
              <Card>
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
                  No tenés turnos próximos. <Link href="/reservar" style={{ color: 'var(--teal)' }}>Reservar uno →</Link>
                </div>
              </Card>
            ) : proximos.map((t: any) => <TurnoCard key={t.id} t={t} />)}
          </Section>

          {pasados.length > 0 && (
            <Section titulo="Historial reciente">
              {pasados.map((t: any) => <TurnoCard key={t.id} t={t} pasado />)}
            </Section>
          )}
        </>
      )}
    </div>
  )
}

function TurnoCard({ t, pasado }: { t: any; pasado?: boolean }) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--noir)' }}>
            {format(new Date(t.fecha_hora), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {t.prestacion?.nombre ?? 'Consulta'} ·  {t.profesional.usuario.apellido}, {t.profesional.usuario.nombre} · {t.profesional.especialidad.nombre}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            📍 {t.sede.nombre}{t.consultorio?.nombre && ` · ${t.consultorio.nombre}`}{t.sede.direccion && ` · ${t.sede.direccion}`}
          </div>
        </div>
        <Estado v={t.estado} />
      </div>

      {t.modalidad === 'VIRTUAL' && !pasado && t.videoconsulta_url && (
        <a href={t.videoconsulta_url} target="_blank" rel="noreferrer" style={{
          display: 'inline-block', marginTop: 8, padding: '8px 14px',
          background: 'var(--teal)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500,
        }}>📹 Unirme a la videoconsulta</a>
      )}
    </Card>
  )
}

function Estado({ v }: { v: string }) {
  const colores: Record<string, { bg: string; fg: string; label: string }> = {
    PENDIENTE: { bg: 'var(--warning-l)', fg: 'var(--warning)', label: 'Pendiente' },
    PENDIENTE_PAGO_MP: { bg: 'var(--warning-l)', fg: 'var(--warning)', label: 'Pendiente pago' },
    CONFIRMADO: { bg: 'var(--clinical-l)', fg: 'var(--clinical)', label: 'Confirmado' },
    EN_SALA_ESPERA: { bg: 'var(--info-l)', fg: 'var(--info)', label: 'En sala' },
    EN_ATENCION: { bg: 'var(--teal-l)', fg: 'var(--teal-d)', label: 'En atención' },
    ATENDIDO: { bg: 'var(--salud-l)', fg: 'var(--salud)', label: 'Atendido' },
    CANCELADO: { bg: 'var(--danger-l)', fg: 'var(--danger)', label: 'Cancelado' },
    AUSENTE: { bg: 'var(--bg-3)', fg: 'var(--muted)', label: 'No asistí' },
  }
  const c = colores[v] ?? { bg: 'var(--bg-2)', fg: 'var(--noir)', label: v }
  return <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg, whiteSpace: 'nowrap' }}>{c.label}</span>
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{titulo}</h2>
      {children}
    </div>
  )
}
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 10 }}>{children}</div>
}
function Empty({ texto }: { texto: string }) { return <Card><div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div></Card> }
function ErrorBanner({ texto }: { texto: string }) { return <div style={{ padding: 14, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>{texto}</div> }
