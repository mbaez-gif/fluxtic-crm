'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  usePaciente, useHistorialPaciente, useAlertasClinicas,
  useCrearAlertaClinica, useEliminarAlertaClinica,
} from '@/hooks/useApi'
import PacienteForm from '@/components/admin/pacientes/PacienteForm'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

type Tab = 'datos' | 'cobertura' | 'contactos' | 'antecedentes' | 'historial' | 'editar'

export default function PacienteFichaPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''
  const { data: paciente, isLoading, error } = usePaciente(id)
  const alertas = useAlertasClinicas(id)
  const historial = useHistorialPaciente(id)
  const [tab, setTab] = useState<Tab>('datos')

  if (isLoading) return <div style={{ padding: 24 }}>Cargando...</div>
  if (error || !paciente) return <div style={{ padding: 24, color: 'var(--danger)' }}>Error: {(error as any)?.message ?? 'paciente no encontrado'}</div>

  const cobPrincipal = paciente.coberturas?.find((c: any) => c.principal && c.activa)

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <Link href="/admin/pacientes" style={{ fontSize: 13, color: 'var(--muted)' }}>← Pacientes</Link>

      {/* Banner de alertas clínicas críticas */}
      {(alertas.data ?? []).filter((a: any) => a.severidad === 'CRITICA').length > 0 && (
        <div style={{
          marginTop: 12, padding: '12px 16px',
          background: 'var(--danger-l)', color: 'var(--danger)',
          borderRadius: 8, borderLeft: '4px solid var(--danger)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Alertas clínicas críticas</div>
            <div style={{ fontSize: 12 }}>
              {(alertas.data ?? []).filter((a: any) => a.severidad === 'CRITICA').map((a: any) => a.titulo).join(' · ')}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16, marginBottom: 16 }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--teal), var(--teal-d))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 22, fontWeight: 600,
        }}>
          {paciente.nombre[0]}{paciente.apellido[0]}
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--noir)' }}>{paciente.apellido}, {paciente.nombre}</h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span>DNI {paciente.dni}</span>
            {paciente.fecha_nacimiento && <span>{calcularEdad(paciente.fecha_nacimiento)} años · {format(new Date(paciente.fecha_nacimiento), "d MMM yyyy", { locale: es })}</span>}
            <span>· {paciente.sexo === 'SIN_DATO' ? 's/d' : paciente.sexo.toLowerCase()}</span>
            <span>· {paciente.telefono ?? 'sin teléfono'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <span className={`status-badge s-${paciente.estado.toLowerCase().replace('_', '-')}`}>{paciente.estado}</span>
          <SegmentoBadge valor={paciente.segmento} />
        </div>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <Kpi label="Turnos" value={paciente._count?.turnos ?? 0} link={`/admin/agenda?paciente_id=${paciente.id}`} />
        <Kpi label="Comprobantes" value={paciente._count?.comprobantes ?? 0} link={`/admin/facturacion?paciente_id=${paciente.id}`} />
        <Kpi label="Recetas" value={paciente._count?.recetas ?? 0} />
        <Kpi label="Total gastado" value={`$${Number(paciente.total_gastado ?? 0).toLocaleString('es-AR')}`} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {([
          ['datos', 'Datos personales'],
          ['cobertura', 'Cobertura'],
          ['contactos', 'Contactos'],
          ['antecedentes', 'Alertas y antecedentes'],
          ['historial', 'Historial'],
          ['editar', 'Editar'],
        ] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              padding: '10px 16px', border: 'none', background: 'transparent',
              fontSize: 13, fontWeight: tab === k ? 600 : 400,
              color: tab === k ? 'var(--teal)' : 'var(--muted)',
              borderBottom: `2px solid ${tab === k ? 'var(--teal)' : 'transparent'}`,
              cursor: 'pointer', marginBottom: -1,
            }}
          >{label}</button>
        ))}
      </div>

      {/* Banner de auditoría siempre visible */}
      <div style={{ background: 'var(--info-l)', color: 'var(--info)', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 16 }}>
        🔒 El acceso a esta ficha y a la historia clínica queda registrado con tu usuario, fecha e IP.
      </div>

      {/* Contenido por tab */}
      {tab === 'datos' && <TabDatos paciente={paciente} />}
      {tab === 'cobertura' && <TabCobertura paciente={paciente} />}
      {tab === 'contactos' && <TabContactos paciente={paciente} />}
      {tab === 'antecedentes' && <TabAntecedentes pacienteId={id} alertas={alertas.data ?? []} />}
      {tab === 'historial' && <TabHistorial historial={historial.data} loading={historial.isLoading} />}
      {tab === 'editar' && <PacienteForm paciente={paciente} onSuccess={() => setTab('datos')} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Tabs
// ════════════════════════════════════════════════════════════════

function TabDatos({ paciente }: { paciente: any }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card titulo="Identificación">
        <Row k="DNI" v={paciente.dni} />
        <Row k="Nombre" v={paciente.nombre} />
        <Row k="Apellido" v={paciente.apellido} />
        <Row k="Fecha de nacimiento" v={paciente.fecha_nacimiento ? format(new Date(paciente.fecha_nacimiento), "d MMM yyyy", { locale: es }) : '—'} />
        <Row k="Sexo" v={paciente.sexo === 'SIN_DATO' ? '—' : paciente.sexo.toLowerCase()} />
        <Row k="Ocupación" v={paciente.ocupacion ?? '—'} />
      </Card>
      <Card titulo="Contacto">
        <Row k="Teléfono" v={paciente.telefono ?? '—'} />
        <Row k="Email" v={paciente.email ?? '—'} />
        <Row k="Dirección" v={paciente.direccion ?? '—'} />
        <Row k="Ciudad" v={paciente.ciudad ?? '—'} />
        <Row k="Provincia" v={paciente.provincia ?? '—'} />
      </Card>
      <Card titulo="CRM">
        <Row k="Estado" v={paciente.estado} />
        <Row k="Segmento" v={paciente.segmento} />
        <Row k="Canal de origen" v={paciente.canal_origen} />
        {paciente.referido_por && <Row k="Referido por" v={paciente.referido_por} />}
        {paciente.campania_origen && <Row k="Campaña" v={paciente.campania_origen} />}
        <Row k="Última atención" v={paciente.ultima_atencion_at ? format(new Date(paciente.ultima_atencion_at), "d MMM yyyy", { locale: es }) : 'Nunca'} />
      </Card>
      <Card titulo="Observaciones administrativas">
        <div style={{ fontSize: 13, color: 'var(--noir)', whiteSpace: 'pre-wrap', minHeight: 60 }}>
          {paciente.observaciones || <span style={{ color: 'var(--muted)' }}>Sin observaciones</span>}
        </div>
      </Card>
    </div>
  )
}

function TabCobertura({ paciente }: { paciente: any }) {
  const cob = paciente.coberturas ?? []
  return (
    <div>
      {cob.length === 0 ? (
        <Card titulo="Cobertura">
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>El paciente no tiene cobertura asociada (atención particular).</div>
        </Card>
      ) : cob.map((c: any) => (
        <div key={c.id} style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 16, marginBottom: 12,
          borderLeft: c.principal ? '4px solid var(--teal)' : '4px solid var(--border)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--noir)' }}>{c.cobertura.nombre}</div>
              {c.plan && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Plan: {c.plan.nombre}</div>}
            </div>
            {c.principal && <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--teal-l)', color: 'var(--teal-d)', fontSize: 10, fontWeight: 600 }}>PRINCIPAL</span>}
          </div>
          <Row k="N° de afiliado" v={c.numero_afiliado} />
          {c.vigencia_desde && <Row k="Vigencia desde" v={format(new Date(c.vigencia_desde), "d MMM yyyy", { locale: es })} />}
          {c.vigencia_hasta && <Row k="Vigencia hasta" v={format(new Date(c.vigencia_hasta), "d MMM yyyy", { locale: es })} />}
        </div>
      ))}
    </div>
  )
}

function TabContactos({ paciente }: { paciente: any }) {
  const cs = paciente.contactos ?? []
  return (
    <div>
      {cs.length === 0 ? (
        <Card titulo="Contactos de emergencia">
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin contactos cargados.</div>
        </Card>
      ) : cs.map((c: any) => (
        <div key={c.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.vinculo ?? 'Familiar'} · {c.telefono}</div>
            </div>
            {c.prioritario && <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--warning-l)', color: 'var(--warning)', fontSize: 10, fontWeight: 600 }}>PRIORITARIO</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

function TabAntecedentes({ pacienteId, alertas }: { pacienteId: string; alertas: any[] }) {
  const [titulo, setTitulo] = useState('')
  const [desc, setDesc] = useState('')
  const [severidad, setSeveridad] = useState<'INFO' | 'ADVERTENCIA' | 'CRITICA'>('ADVERTENCIA')
  const crear = useCrearAlertaClinica()
  const eliminar = useEliminarAlertaClinica()

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo) return
    await crear.mutateAsync({ paciente_id: pacienteId, titulo, descripcion: desc || null, severidad })
    setTitulo(''); setDesc('')
  }

  const colores: Record<string, { bg: string; fg: string }> = {
    INFO: { bg: 'var(--info-l)', fg: 'var(--info)' },
    ADVERTENCIA: { bg: 'var(--warning-l)', fg: 'var(--warning)' },
    CRITICA: { bg: 'var(--danger-l)', fg: 'var(--danger)' },
  }

  return (
    <div>
      <Card titulo="Alertas clínicas activas">
        {alertas.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin alertas. Agregá una abajo si hay condiciones relevantes.</div>
        ) : alertas.map((a) => {
          const c = colores[a.severidad]
          return (
            <div key={a.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 12px', background: c.bg, color: c.fg, borderRadius: 8, marginBottom: 8,
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.titulo}</div>
                {a.descripcion && <div style={{ fontSize: 12, opacity: .85 }}>{a.descripcion}</div>}
              </div>
              <button onClick={() => eliminar.mutate(a.id)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 12 }}>quitar</button>
            </div>
          )
        })}
      </Card>

      <Card titulo="Agregar alerta">
        <form onSubmit={agregar} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej. Diabetes tipo 2)" required style={input} />
          <select value={severidad} onChange={(e) => setSeveridad(e.target.value as any)} style={input}>
            <option value="INFO">Info</option>
            <option value="ADVERTENCIA">Advertencia</option>
            <option value="CRITICA">Crítica</option>
          </select>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción (opcional)" style={{ ...input, gridColumn: 'span 2' }} />
          <button type="submit" disabled={crear.isPending} style={{ ...btnPrimary, gridColumn: 'span 2' }}>
            {crear.isPending ? 'Guardando...' : 'Agregar alerta'}
          </button>
        </form>
      </Card>

      <Card titulo="Antecedentes, alergias y medicación">
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
          La gestión completa de antecedentes, alergias y medicación habitual está disponible en la historia clínica.
        </div>
        <Link href={`/admin/historia-clinica/paciente/${pacienteId}`} style={{ ...btnPrimary, display: 'inline-block', textDecoration: 'none' }}>
          Abrir historia clínica completa →
        </Link>
      </Card>
    </div>
  )
}

function TabHistorial({ historial, loading }: { historial: any; loading: boolean }) {
  if (loading || !historial) return <div style={{ color: 'var(--muted)', padding: 16, fontSize: 13 }}>Cargando historial...</div>
  const turnos = historial.turnos ?? []
  const recetas = historial.recetas ?? []
  const comprobantes = historial.comprobantes ?? []
  const comunicaciones = historial.comunicaciones ?? []

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Card titulo={`Turnos (${turnos.length})`}>
        {turnos.length === 0 ? <Empty /> : turnos.slice(0, 10).map((t: any) => (
          <ListItem
            key={t.id}
            titulo={`${format(new Date(t.fecha_hora), "d MMM yyyy HH:mm", { locale: es })} · ${t.prestacion?.nombre ?? 'Consulta'}`}
            sub={`${t.profesional.usuario.apellido}, ${t.profesional.usuario.nombre} · ${t.estado}`}
          />
        ))}
      </Card>
      <Card titulo={`Recetas (${recetas.length})`}>
        {recetas.length === 0 ? <Empty /> : recetas.slice(0, 10).map((r: any) => (
          <ListItem
            key={r.id}
            titulo={`${format(new Date(r.fecha), "d MMM yyyy", { locale: es })} · ${r.tipo}`}
            sub={`${r.estado} · ${r.items.length} indicación(es)`}
          />
        ))}
      </Card>
      <Card titulo={`Comprobantes (${comprobantes.length})`}>
        {comprobantes.length === 0 ? <Empty /> : comprobantes.slice(0, 10).map((c: any) => (
          <ListItem
            key={c.id}
            titulo={`${format(new Date(c.fecha), "d MMM yyyy", { locale: es })} · ${c.tipo}`}
            sub={`$${Number(c.total).toLocaleString('es-AR')} · ${c.estado}`}
          />
        ))}
      </Card>
      <Card titulo={`Comunicaciones (${comunicaciones.length})`}>
        {comunicaciones.length === 0 ? <Empty /> : comunicaciones.slice(0, 10).map((c: any) => (
          <ListItem
            key={c.id}
            titulo={`${format(new Date(c.created_at), "d MMM HH:mm", { locale: es })} · ${c.tipo}`}
            sub={`${c.canal} · ${c.estado}`}
          />
        ))}
      </Card>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// UI helpers
// ════════════════════════════════════════════════════════════════

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid var(--border-2)' }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <span style={{ color: 'var(--noir)', fontWeight: 500, textAlign: 'right' }}>{v}</span>
    </div>
  )
}
function Kpi({ label, value, link }: { label: string; value: string | number; link?: string }) {
  const content = (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: link ? 'var(--teal)' : 'var(--noir)' }}>{value}</div>
    </div>
  )
  return link ? <Link href={link} style={{ display: 'block' }}>{content}</Link> : content
}
function ListItem({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border-2)', fontSize: 13 }}>
      <div style={{ color: 'var(--noir)', fontWeight: 500 }}>{titulo}</div>
      <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{sub}</div>
    </div>
  )
}
function Empty() { return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin registros</div> }

function SegmentoBadge({ valor }: { valor: string }) {
  if (!valor || valor === 'GENERAL') return null
  const colores: Record<string, { bg: string; fg: string }> = {
    VIP: { bg: 'var(--warning-l)', fg: 'var(--warning)' },
    CRONICO: { bg: 'var(--info-l)', fg: 'var(--info)' },
    SEGUIMIENTO: { bg: 'var(--clinical-l)', fg: 'var(--clinical)' },
    PARTICULAR: { bg: 'var(--bg-2)', fg: 'var(--noir)' },
    COBERTURA: { bg: 'var(--teal-l)', fg: 'var(--teal-d)' },
  }
  const c = colores[valor] ?? { bg: 'var(--bg-2)', fg: 'var(--noir)' }
  return <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg, textTransform: 'capitalize' }}>{valor.toLowerCase()}</span>
}

function calcularEdad(fecha: string): number {
  const f = new Date(fecha)
  const hoy = new Date()
  let edad = hoy.getFullYear() - f.getFullYear()
  const m = hoy.getMonth() - f.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < f.getDate())) edad--
  return edad
}

const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)' }
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
