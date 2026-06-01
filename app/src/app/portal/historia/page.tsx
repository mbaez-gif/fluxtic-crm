'use client'

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePortalMiHistoria } from '@/hooks/useApi'

export default function PortalHistoriaPage() {
  const { data, isLoading, error } = usePortalMiHistoria()

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6, color: 'var(--noir)' }}>Mi historia clínica</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
        Acá ves las evoluciones firmadas por tus profesionales y las indicaciones autorizadas a verse desde el portal.
      </p>

      <div style={{ padding: 12, background: 'var(--info-l)', color: 'var(--info)', borderRadius: 8, fontSize: 12, marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span>ℹ</span>
        <div>Esta vista es de solo lectura. Solo se muestran evoluciones firmadas y datos clínicos habilitados por tu médico/a.</div>
      </div>

      {isLoading && <Card><div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div></Card>}
      {error && <div style={{ padding: 14, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>{(error as any)?.message ?? 'Error'}</div>}

      {data && (
        <>
          <Section titulo={`Evoluciones (${(data.evoluciones ?? []).length})`}>
            {(data.evoluciones ?? []).length === 0 ? (
              <Card><div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Aún no hay evoluciones firmadas.</div></Card>
            ) : data.evoluciones.map((e: any) => (
              <Card key={e.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--noir)' }}>
                      {format(new Date(e.fecha), "EEEE d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Dr/a. {e.profesional.usuario.apellido}, {e.profesional.usuario.nombre} · {e.profesional.especialidad.nombre}
                    </div>
                  </div>
                  <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'var(--salud-l)', color: 'var(--salud)' }}>FIRMADA</span>
                </div>
                {e.motivo_consulta && <Bloque label="Motivo" texto={e.motivo_consulta} />}
                {e.plan && <Bloque label="Plan / tratamiento" texto={e.plan} />}
              </Card>
            ))}
          </Section>

          <Section titulo={`Indicaciones (${(data.indicaciones ?? []).length})`}>
            {(data.indicaciones ?? []).length === 0 ? (
              <Card><div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Sin indicaciones disponibles.</div></Card>
            ) : data.indicaciones.map((i: any) => (
              <Card key={i.id}>
                <div style={{ fontSize: 13, color: 'var(--noir)', whiteSpace: 'pre-wrap' }}>{i.texto}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{format(new Date(i.fecha), "d MMM yyyy", { locale: es })}</div>
              </Card>
            ))}
          </Section>
        </>
      )}
    </div>
  )
}

function Bloque({ label, texto }: { label: string; texto: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 8 }}>{label}:</span>
      <span style={{ fontSize: 13, color: 'var(--noir)', whiteSpace: 'pre-wrap' }}>{texto}</span>
    </div>
  )
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
