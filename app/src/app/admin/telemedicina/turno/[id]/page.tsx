'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useSalaVideoconsulta, useGenerarLinkVc, useIniciarVc, useFinalizarVc } from '@/hooks/useApi'

export default function SalaVideoconsultaPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const { data, isLoading, refetch } = useSalaVideoconsulta(id)
  const generarLink = useGenerarLinkVc()
  const iniciar = useIniciarVc()
  const finalizar = useFinalizarVc()

  if (isLoading) return <div style={{ padding: 24 }}>Cargando sala...</div>
  if (!data) return <div style={{ padding: 24, color: 'var(--danger)' }}>Turno no encontrado</div>

  async function handleGenerarLink() {
    await generarLink.mutateAsync(id)
    await refetch()
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <Link href="/admin/agenda" style={{ fontSize: 13, color: 'var(--muted)' }}>← Agenda</Link>

      <div style={{ marginTop: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>📹 Videoconsulta</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {format(new Date(data.fecha_hora), "EEEE d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
          </div>
        </div>
        <span className={`status-badge s-${data.estado.toLowerCase().replace('_', '-')}`}>{data.estado.replace('_', ' ')}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Sala (iframe Jitsi) */}
        <div>
          {data.videoconsulta_url ? (
            <>
              <iframe
                src={data.videoconsulta_url}
                allow="camera; microphone; fullscreen; display-capture"
                style={{
                  width: '100%', height: 500,
                  border: '1px solid var(--border)', borderRadius: 12,
                  background: '#000',
                }}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {data.videoconsulta_estado === 'PENDIENTE' && (
                  <button onClick={() => iniciar.mutate(id)} disabled={iniciar.isPending} style={btnPrimary}>
                    {iniciar.isPending ? 'Iniciando...' : '▶ Iniciar atención'}
                  </button>
                )}
                {data.videoconsulta_estado === 'EN_CURSO' && (
                  <button onClick={() => finalizar.mutate(id)} disabled={finalizar.isPending} style={btnDanger}>
                    {finalizar.isPending ? 'Finalizando...' : '■ Finalizar y marcar atendido'}
                  </button>
                )}
                <a href={data.videoconsulta_url} target="_blank" rel="noreferrer" style={btnSecondary}>
                  Abrir en pestaña nueva
                </a>
              </div>
            </>
          ) : (
            <div style={{
              background: 'var(--surface)', border: '2px dashed var(--border-2)',
              borderRadius: 12, padding: 60, textAlign: 'center',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📹</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No hay sala generada</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
                Al generar la sala se crea un link Jitsi único y se envía al paciente por WhatsApp.
              </p>
              <button onClick={handleGenerarLink} disabled={generarLink.isPending} style={btnPrimary}>
                {generarLink.isPending ? 'Generando...' : 'Generar sala'}
              </button>
            </div>
          )}
        </div>

        {/* Sidebar con info de la consulta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card titulo="Paciente">
            <div style={{ fontSize: 15, fontWeight: 600 }}>{data.paciente.apellido}, {data.paciente.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>DNI {data.paciente.dni}</div>
            <Link href={`/admin/pacientes/${data.paciente.id}`} style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--teal)', fontWeight: 500 }}>
              Ver ficha del paciente →
            </Link>
          </Card>

          <Card titulo="Profesional">
            <div style={{ fontSize: 14, fontWeight: 600 }}>{data.profesional.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>{data.profesional.especialidad}</div>
          </Card>

          {data.prestacion && (
            <Card titulo="Prestación">
              <div style={{ fontSize: 13 }}>{data.prestacion}</div>
            </Card>
          )}

          <Card titulo="Acciones rápidas">
            <Link href={`/admin/historia-clinica/paciente/${data.paciente.id}`} style={{ display: 'block', padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 13, marginBottom: 6, textAlign: 'center' }}>
              Abrir historia clínica →
            </Link>
            <Link href={`/admin/recetas/nueva?paciente_id=${data.paciente.id}`} style={{ display: 'block', padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6, fontSize: 13, textAlign: 'center' }}>
              Generar receta →
            </Link>
          </Card>

          <Card titulo="Proveedor">
            <div style={{ fontSize: 13 }}>{data.videoconsulta_proveedor ?? '—'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Estado: {data.videoconsulta_estado ?? 'pendiente'}</div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{titulo}</div>
      {children}
    </div>
  )
}

const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'transparent', color: 'var(--noir)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
const btnDanger: React.CSSProperties = { padding: '10px 18px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
