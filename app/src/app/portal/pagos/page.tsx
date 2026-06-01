'use client'

import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { usePortalMisPagos } from '@/hooks/useApi'

export default function PortalPagosPage() {
  const { data, isLoading, error } = usePortalMisPagos()

  const pagos: any[] = data?.pagos ?? []
  const pendientes: any[] = data?.comprobantes_pendientes ?? []
  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto), 0)
  const totalPendiente = pendientes.reduce((s, c) => s + Number(c.saldo ?? c.total), 0)

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 6, color: 'var(--noir)' }}>Mis pagos</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        Pagos registrados y comprobantes pendientes de cancelar.
      </p>

      {isLoading && <Card><div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div></Card>}
      {error && <div style={{ padding: 14, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>{(error as any)?.message ?? 'Error'}</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
            <Card>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Total pagado</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--salud)', marginTop: 4 }}>${totalPagado.toLocaleString('es-AR')}</div>
            </Card>
            <Card>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Saldo pendiente</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: totalPendiente > 0 ? 'var(--danger)' : 'var(--noir)', marginTop: 4 }}>${totalPendiente.toLocaleString('es-AR')}</div>
            </Card>
          </div>

          {pendientes.length > 0 && (
            <Section titulo="Comprobantes pendientes">
              {pendientes.map((c: any) => (
                <Card key={c.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{c.tipo} {c.numero ?? `#${c.id.slice(-8).toUpperCase()}`}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{format(new Date(c.fecha), "d MMM yyyy", { locale: es })}</div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>${Number(c.saldo ?? c.total).toLocaleString('es-AR')}</div>
                  </div>
                </Card>
              ))}
            </Section>
          )}

          <Section titulo={`Historial de pagos (${pagos.length})`}>
            {pagos.length === 0 ? (
              <Card><div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Sin pagos registrados todavía.</div></Card>
            ) : pagos.map((p: any) => (
              <Card key={p.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{format(new Date(p.fecha), "d MMM yyyy HH:mm", { locale: es })}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {p.medio} {p.comprobante?.numero && `· ${p.comprobante.numero}`}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--salud)' }}>${Number(p.monto).toLocaleString('es-AR')}</div>
                </div>
              </Card>
            ))}
          </Section>
        </>
      )}
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
