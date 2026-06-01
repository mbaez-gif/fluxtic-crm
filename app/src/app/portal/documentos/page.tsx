'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePortalMisDocumentos } from '@/hooks/useApi'
import { api } from '@/lib/api'

export default function PortalDocumentosPage() {
  const { data: docs, isLoading, error } = usePortalMisDocumentos()
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  async function descargar(id: string) {
    setDownloadingId(id)
    try {
      const res = await api.get<{ url: string }>(`/documentos/${id}/download`)
      window.open(res.url, '_blank')
    } catch (e: any) {
      alert(`No se pudo descargar: ${e?.message ?? 'error'}`)
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6, color: 'var(--noir)' }}>Mis documentos</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        Estudios, recetas e informes que tu médico/a habilitó para que veas desde el portal.
      </p>

      {isLoading && <Card><div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div></Card>}
      {error && <div style={{ padding: 14, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>{(error as any)?.message ?? 'Error'}</div>}

      {docs && (
        docs.length === 0 ? (
          <Card><div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No tenés documentos disponibles todavía.</div></Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {docs.map((d: any) => (
              <Card key={d.id}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--teal-l)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📄</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--noir)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {d.tipo} · {format(new Date(d.created_at), "d MMM yyyy", { locale: es })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => descargar(d.id)}
                  disabled={downloadingId === d.id}
                  style={{
                    width: '100%', marginTop: 12, padding: '8px 12px',
                    background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {downloadingId === d.id ? 'Generando link...' : '⬇ Descargar'}
                </button>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>{children}</div>
}
