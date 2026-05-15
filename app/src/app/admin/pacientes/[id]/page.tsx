'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface PacienteFicha {
  id: string
  dni: string
  nombre: string
  apellido: string
  fecha_nacimiento: string | null
  sexo: string
  telefono: string | null
  email: string | null
  direccion: string | null
  estado: string
  observaciones: string | null
  contactos: Array<{ id: string; nombre: string; vinculo: string | null; telefono: string; prioritario: boolean }>
  coberturas: Array<{ id: string; numero_afiliado: string; cobertura: { nombre: string }; plan: { nombre: string } | null }>
  historia_clinica: { id: string; numero: string | null } | null
  _count: { turnos: number; comprobantes: number }
}

export default function PacienteFichaPage() {
  const params = useParams<{ id: string }>()
  const [data, setData] = useState<PacienteFicha | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
    fetch(`${apiBase}/pacientes/${params.id}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`API ${r.status}`)))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) return <div style={{ padding: 28 }}>Cargando...</div>
  if (error || !data) return <div style={{ padding: 28, color: 'var(--danger)' }}>Error: {error}</div>

  return (
    <div style={{ padding: 28, maxWidth: 1100 }}>
      <Link href="/admin/pacientes" style={{ fontSize: 13, color: 'var(--muted)' }}>← Pacientes</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, marginBottom: 24 }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--teal), var(--teal-d))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 22, fontWeight: 600,
        }}>
          {data.nombre[0]}{data.apellido[0]}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--noir)' }}>{data.apellido}, {data.nombre}</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
            DNI {data.dni} · {data.fecha_nacimiento ? `Nacimiento ${new Date(data.fecha_nacimiento).toLocaleDateString('es-AR')}` : 'Sin fecha de nacimiento'} · {data.sexo}
          </div>
        </div>
        <span className={`status-badge s-${data.estado.toLowerCase()}`}>{data.estado}</span>
      </div>

      <div style={{ background: 'var(--info-l)', color: 'var(--info)', padding: 12, borderRadius: 8, fontSize: 12, marginBottom: 20 }}>
        Toda visualización de la historia clínica queda auditada con tu usuario, IP y fecha.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card titulo="Datos de contacto">
          <Row k="Teléfono" v={data.telefono ?? '—'} />
          <Row k="Email" v={data.email ?? '—'} />
          <Row k="Dirección" v={data.direccion ?? '—'} />
        </Card>
        <Card titulo="Cobertura principal">
          {data.coberturas.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Particular — sin obra social</div>
          ) : (
            data.coberturas.slice(0, 2).map((c) => (
              <Row key={c.id} k={c.cobertura.nombre} v={`${c.plan?.nombre ?? 'Plan estándar'} · Afiliado ${c.numero_afiliado}`} />
            ))
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Turnos" value={data._count.turnos} link={`/admin/agenda?paciente_id=${data.id}`} />
        <StatCard label="Comprobantes" value={data._count.comprobantes} link={`/admin/facturacion?paciente_id=${data.id}`} />
        <StatCard label="Historia clínica" value={data.historia_clinica ? 'Ver' : 'Crear'} link={`/admin/historia-clinica?paciente_id=${data.id}`} />
      </div>

      {data.observaciones && (
        <Card titulo="Observaciones administrativas">
          <div style={{ fontSize: 13, color: 'var(--noir)', whiteSpace: 'pre-wrap' }}>{data.observaciones}</div>
        </Card>
      )}
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
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

function StatCard({ label, value, link }: { label: string; value: string | number; link: string }) {
  return (
    <Link href={link} style={{
      display: 'block', padding: 14, background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 10,
    }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, color: 'var(--teal)', fontWeight: 600 }}>{value}</div>
    </Link>
  )
}
