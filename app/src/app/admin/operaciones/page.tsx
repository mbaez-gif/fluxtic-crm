'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCambiarEstadoTurno } from '@/hooks/useApi'

// ────────────────────────────────────────────────────────────────
// Tipos del payload /operaciones/dia
// ────────────────────────────────────────────────────────────────
type EstadoTurno =
  | 'PENDIENTE' | 'PENDIENTE_PAGO_MP' | 'PENDIENTE_VALIDACION_MANUAL'
  | 'CONFIRMADO' | 'EN_SALA_ESPERA' | 'EN_ATENCION' | 'ATENDIDO'
  | 'CANCELADO' | 'AUSENTE' | 'VENCIDO'

type EstadoConsultorio = 'LIBRE' | 'OCUPADO' | 'DEMORADO' | 'INACTIVO'

interface TurnoOp {
  id: string
  fecha_hora: string
  duracion_min: number
  estado: EstadoTurno
  modalidad: string
  sobreturno: boolean
  motivo_consulta: string | null
  observaciones: string | null
  mensaje_interno: string | null
  ingreso_sala_at: string | null
  inicio_atencion_at: string | null
  fin_atencion_at: string | null
  cancelado_motivo: string | null
  paciente: { id: string; nombre: string; apellido: string; dni: string; telefono: string | null; email: string | null; observaciones: string | null }
  profesional: { id: string; nombre: string; color: string | null; especialidad: string | null }
  prestacion: { id: string; nombre: string; duracion_min: number } | null
  sede: { id: string; nombre: string }
  consultorio: { id: string; nombre: string; numero: string | null } | null
  cobertura: { nombre: string; tipo: string; numero_afiliado: string } | null
  deuda_saldo: number
  comprobante_saldo: number
  comprobante_id: string | null
  flags: {
    sin_confirmar: boolean
    sin_cobertura: boolean
    con_deuda: boolean
    con_saldo_comprobante: boolean
    recordatorio_no_enviado: boolean
    medico_atrasado: boolean
    copago_pendiente: boolean
  }
  minutos_hasta_turno: number
}

interface ConsultorioOp {
  id: string
  nombre: string
  numero: string | null
  sede_id: string
  estado: EstadoConsultorio
  demora_min: number | null
  medico_actual: { id: string; nombre: string; color: string | null } | null
  paciente_actual: { id: string; nombre: string; turno_id: string; inicio_atencion_at: string | null } | null
  proximo_paciente: { id: string; nombre: string; turno_id: string; fecha_hora: string } | null
  en_espera_count: number
  turnos_dia_count: number
}

interface OperacionesPayload {
  fecha: string
  kpis: {
    total: number
    por_estado: Record<string, number>
    ausentismo_pct: number
    demora_promedio_min: number | null
    saldo_pendiente_total: number
    sin_confirmar: number
    con_deuda: number
    con_alerta: number
  }
  turnos: TurnoOp[]
  consultorios: ConsultorioOp[]
  sedes: { id: string; nombre: string }[]
  profesionales: { id: string; nombre: string; especialidad: string | null; color: string | null }[]
}

// ────────────────────────────────────────────────────────────────
// Configuración visual de estados
// ────────────────────────────────────────────────────────────────
const COLUMNAS: { id: EstadoTurno[]; label: string; bg: string; fg: string }[] = [
  { id: ['PENDIENTE', 'PENDIENTE_PAGO_MP', 'PENDIENTE_VALIDACION_MANUAL'], label: 'Por confirmar', bg: 'var(--warning-l)', fg: 'var(--warning)' },
  { id: ['CONFIRMADO'],     label: 'Confirmados',     bg: 'var(--info-l)',    fg: 'var(--info)' },
  { id: ['EN_SALA_ESPERA'], label: 'En sala de espera', bg: 'var(--teal-l)',  fg: 'var(--teal)' },
  { id: ['EN_ATENCION'],    label: 'En atención',     bg: '#FDE68A',          fg: '#92400E' },
  { id: ['ATENDIDO'],       label: 'Atendidos',       bg: 'var(--salud-l)',   fg: 'var(--salud)' },
  { id: ['AUSENTE', 'CANCELADO', 'VENCIDO'], label: 'Ausentes / cancelados', bg: 'var(--danger-l)', fg: 'var(--danger)' },
]

const ESTADO_LABELS: Record<EstadoTurno, string> = {
  PENDIENTE: 'Pendiente',
  PENDIENTE_PAGO_MP: 'Pendiente pago',
  PENDIENTE_VALIDACION_MANUAL: 'Pendiente validar',
  CONFIRMADO: 'Confirmado',
  EN_SALA_ESPERA: 'En sala de espera',
  EN_ATENCION: 'En atención',
  ATENDIDO: 'Atendido',
  CANCELADO: 'Cancelado',
  AUSENTE: 'Ausente',
  VENCIDO: 'Vencido',
}

// ────────────────────────────────────────────────────────────────
// Página principal
// ────────────────────────────────────────────────────────────────
type Tab = 'kanban' | 'consultorios' | 'lista'

export default function OperacionesPage() {
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [sedeId, setSedeId] = useState('')
  const [profesionalId, setProfesionalId] = useState('')
  const [consultorioId, setConsultorioId] = useState('')
  const [tab, setTab] = useState<Tab>('kanban')
  const [turnoSel, setTurnoSel] = useState<string | null>(null)

  const query = useQuery<OperacionesPayload>({
    queryKey: ['operaciones-dia', fecha, sedeId, profesionalId, consultorioId],
    queryFn: () => {
      const qs = new URLSearchParams({ fecha })
      if (sedeId) qs.set('sede_id', sedeId)
      if (profesionalId) qs.set('profesional_id', profesionalId)
      if (consultorioId) qs.set('consultorio_id', consultorioId)
      return api.get<OperacionesPayload>(`/operaciones/dia?${qs.toString()}`)
    },
    refetchInterval: 30_000,
  })

  const data = query.data
  const turnoSelObj = useMemo(
    () => data?.turnos.find((t) => t.id === turnoSel) ?? null,
    [data, turnoSel],
  )

  const fechaObj = new Date(`${fecha}T12:00:00`)
  const esHoy = fecha === new Date().toISOString().slice(0, 10)

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - var(--top-h))', gap: 16 }}>
      {/* ───── Header ───── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
            Centro de operaciones
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, color: 'var(--noir)', margin: 0 }}>
            {esHoy ? 'Operación del día' : format(fechaObj, "EEEE d 'de' MMMM", { locale: es })}
          </h1>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {format(fechaObj, "EEEE d 'de' MMMM, yyyy", { locale: es })}
            {query.isFetching && <span style={{ marginLeft: 12, fontSize: 11 }}>· Actualizando…</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => shiftFecha(fecha, setFecha, -1)} style={btnIcon} title="Día anterior">←</button>
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            style={{ ...inputBase, width: 160, height: 36 }}
          />
          <button onClick={() => shiftFecha(fecha, setFecha, 1)} style={btnIcon} title="Día siguiente">→</button>
          <button onClick={() => setFecha(new Date().toISOString().slice(0, 10))} style={btnSecondary}>Hoy</button>
        </div>
      </div>

      {/* ───── KPIs ───── */}
      <KpiStrip data={data} />

      {/* ───── Filtros + tabs ───── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <SelectFilter label="Sede" value={sedeId} onChange={setSedeId} options={data?.sedes.map((s) => ({ value: s.id, label: s.nombre })) ?? []} />
          <SelectFilter label="Profesional" value={profesionalId} onChange={setProfesionalId} options={data?.profesionales.map((p) => ({ value: p.id, label: p.nombre })) ?? []} />
          <SelectFilter
            label="Consultorio"
            value={consultorioId}
            onChange={setConsultorioId}
            options={(data?.consultorios ?? [])
              .filter((c) => !sedeId || c.sede_id === sedeId)
              .map((c) => ({ value: c.id, label: c.nombre }))}
          />
          {(sedeId || profesionalId || consultorioId) && (
            <button onClick={() => { setSedeId(''); setProfesionalId(''); setConsultorioId('') }} style={btnLink}>
              Limpiar filtros
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-2)', padding: 3, borderRadius: 8 }}>
          {(['kanban', 'consultorios', 'lista'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '8px 16px', border: 'none', cursor: 'pointer',
                borderRadius: 6, fontSize: 13, fontWeight: tab === t ? 600 : 400,
                background: tab === t ? 'var(--surface)' : 'transparent',
                color: tab === t ? 'var(--noir)' : 'var(--muted)',
                boxShadow: tab === t ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
                textTransform: 'capitalize',
              }}
            >
              {t === 'kanban' ? 'Tablero' : t}
            </button>
          ))}
        </div>
      </div>

      {/* ───── Contenido ───── */}
      {query.isLoading && (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          Cargando operación del día…
        </div>
      )}
      {query.error && (
        <div style={{ padding: 14, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, fontSize: 13 }}>
          {(query.error as any)?.message ?? 'Error cargando datos'}
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {tab === 'kanban' && <KanbanView turnos={data.turnos} onSelect={setTurnoSel} selected={turnoSel} />}
            {tab === 'consultorios' && <ConsultoriosView consultorios={data.consultorios} sedes={data.sedes} turnos={data.turnos} />}
            {tab === 'lista' && <ListaView turnos={data.turnos} onSelect={setTurnoSel} selected={turnoSel} />}
          </div>
          {turnoSelObj && (
            <DetalleTurnoPanel turno={turnoSelObj} onClose={() => setTurnoSel(null)} />
          )}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// KPI strip
// ────────────────────────────────────────────────────────────────
function KpiStrip({ data }: { data: OperacionesPayload | undefined }) {
  const kpis = data?.kpis
  const cells: { label: string; value: string; sub?: string; tone?: 'default' | 'salud' | 'warning' | 'danger' | 'info' }[] = [
    { label: 'Turnos hoy', value: String(kpis?.total ?? '—') },
    { label: 'Confirmados', value: String((kpis?.por_estado['CONFIRMADO'] ?? 0) + (kpis?.por_estado['EN_SALA_ESPERA'] ?? 0)), tone: 'info' },
    { label: 'En atención', value: String(kpis?.por_estado['EN_ATENCION'] ?? 0), tone: 'warning' },
    { label: 'Atendidos', value: String(kpis?.por_estado['ATENDIDO'] ?? 0), tone: 'salud' },
    { label: 'Sin confirmar', value: String(kpis?.sin_confirmar ?? 0), tone: (kpis?.sin_confirmar ?? 0) > 0 ? 'warning' : 'default' },
    { label: 'Ausentismo', value: kpis ? `${kpis.ausentismo_pct}%` : '—' },
    { label: 'Demora prom.', value: kpis?.demora_promedio_min != null ? `${kpis.demora_promedio_min} min` : '—' },
    { label: 'Saldo pendiente', value: kpis ? `$${kpis.saldo_pendiente_total.toLocaleString('es-AR')}` : '—', tone: (kpis?.saldo_pendiente_total ?? 0) > 0 ? 'danger' : 'default' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
      {cells.map((k, i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 500 }}>{k.label}</div>
          <div style={{
            fontSize: 22, fontWeight: 600, marginTop: 4,
            color: k.tone === 'salud' ? 'var(--salud)' :
                   k.tone === 'warning' ? 'var(--warning)' :
                   k.tone === 'danger' ? 'var(--danger)' :
                   k.tone === 'info' ? 'var(--info)' : 'var(--noir)',
          }}>{k.value}</div>
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Vista Kanban
// ────────────────────────────────────────────────────────────────
function KanbanView({ turnos, onSelect, selected }: { turnos: TurnoOp[]; onSelect: (id: string) => void; selected: string | null }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, height: '100%', minHeight: 0 }}>
      {COLUMNAS.map((col) => {
        const items = turnos.filter((t) => col.id.includes(t.estado))
        return (
          <div key={col.label} style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-2)', borderRadius: 12, minWidth: 0 }}>
            <div style={{
              padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: col.fg }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--noir)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {col.label}
                </span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: col.fg, background: col.bg, padding: '2px 8px', borderRadius: 10 }}>
                {items.length}
              </span>
            </div>
            <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
              {items.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>Vacío</div>
              ) : (
                items.map((t) => (
                  <TurnoCard key={t.id} turno={t} onClick={() => onSelect(t.id)} selected={selected === t.id} />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TurnoCard({ turno, onClick, selected }: { turno: TurnoOp; onClick: () => void; selected: boolean }) {
  const hora = format(new Date(turno.fecha_hora), 'HH:mm')
  const profColor = turno.profesional.color ?? 'var(--teal)'
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', background: 'var(--surface)', border: selected ? '2px solid var(--teal)' : '1px solid var(--border)',
        borderRadius: 10, padding: 10, cursor: 'pointer', borderLeft: `3px solid ${profColor}`,
        boxShadow: selected ? '0 0 0 3px var(--teal-l)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--noir)' }}>{hora}</span>
        {turno.sobreturno && <Badge tone="warning" text="Sobreturno" />}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--noir)', lineHeight: 1.25 }}>
        {turno.paciente.nombre} {turno.paciente.apellido}
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span>{turno.profesional.nombre}</span>
        {turno.consultorio && <span>{turno.consultorio.nombre} · {turno.sede.nombre}</span>}
      </div>
      <FlagsRow turno={turno} />
    </button>
  )
}

function FlagsRow({ turno }: { turno: TurnoOp }) {
  const flags: { text: string; tone: 'warning' | 'danger' | 'info' }[] = []
  if (turno.flags.con_deuda) flags.push({ text: `Deuda $${turno.deuda_saldo.toLocaleString('es-AR')}`, tone: 'danger' })
  if (turno.flags.sin_cobertura) flags.push({ text: 'Sin cobertura', tone: 'warning' })
  if (turno.flags.medico_atrasado) flags.push({ text: 'Demorado', tone: 'danger' })
  if (turno.flags.copago_pendiente) flags.push({ text: 'Copago pend.', tone: 'warning' })
  if (turno.flags.recordatorio_no_enviado) flags.push({ text: 'Sin recordatorio', tone: 'info' })
  if (flags.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
      {flags.map((f, i) => <Badge key={i} tone={f.tone} text={f.text} size="xs" />)}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Vista Consultorios
// ────────────────────────────────────────────────────────────────
function ConsultoriosView({ consultorios, sedes, turnos }: { consultorios: ConsultorioOp[]; sedes: { id: string; nombre: string }[]; turnos: TurnoOp[] }) {
  if (consultorios.length === 0) {
    return <Empty texto="No hay consultorios activos en la sede seleccionada." />
  }
  const porSede = sedes.map((s) => ({ sede: s, consults: consultorios.filter((c) => c.sede_id === s.id) }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {porSede.map(({ sede, consults }) => consults.length > 0 && (
        <div key={sede.id}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10, fontWeight: 600 }}>
            {sede.nombre} · {consults.length} consultorios
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {consults.map((c) => <ConsultorioCard key={c.id} consult={c} turnos={turnos.filter((t) => t.consultorio?.id === c.id)} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function ConsultorioCard({ consult, turnos }: { consult: ConsultorioOp; turnos: TurnoOp[] }) {
  const tone = {
    LIBRE:    { bg: 'var(--surface)',   border: 'var(--border)',  dot: '#94A3B8' },
    OCUPADO:  { bg: 'var(--info-l)',    border: 'var(--info)',    dot: 'var(--info)' },
    DEMORADO: { bg: 'var(--danger-l)',  border: 'var(--danger)',  dot: 'var(--danger)' },
    INACTIVO: { bg: 'var(--bg-2)',      border: 'var(--border)',  dot: '#CBD5E1' },
  }[consult.estado]
  return (
    <div style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Consultorio</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--noir)' }}>{consult.nombre}{consult.numero && ` · ${consult.numero}`}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--surface)', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, background: tone.dot }} />
          {consult.estado === 'LIBRE' ? 'Libre' : consult.estado === 'OCUPADO' ? 'Ocupado' : consult.estado === 'DEMORADO' ? 'Demorado' : 'Sin turnos'}
        </div>
      </div>

      {consult.medico_actual && (
        <div style={{ fontSize: 12, color: 'var(--noir)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: consult.medico_actual.color ?? 'var(--teal)' }} />
          {consult.medico_actual.nombre}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Row label="Paciente actual" value={consult.paciente_actual?.nombre ?? '—'} />
        <Row label="Próximo" value={consult.proximo_paciente
          ? `${consult.proximo_paciente.nombre} · ${format(new Date(consult.proximo_paciente.fecha_hora), 'HH:mm')}`
          : '—'} />
        {consult.demora_min != null && consult.demora_min > 0 && (
          <Row label="Demora" value={`${consult.demora_min} min`} valueColor="var(--danger)" />
        )}
        {consult.en_espera_count > 0 && (
          <Row label="En sala de espera" value={`${consult.en_espera_count} paciente(s)`} />
        )}
      </div>

      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 8, fontSize: 11, color: 'var(--muted)' }}>
        {turnos.length} turno{turnos.length === 1 ? '' : 's'} programado{turnos.length === 1 ? '' : 's'} hoy
      </div>
    </div>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</span>
      <span style={{ fontSize: 12, color: valueColor ?? 'var(--noir)', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Vista Lista
// ────────────────────────────────────────────────────────────────
function ListaView({ turnos, onSelect, selected }: { turnos: TurnoOp[]; onSelect: (id: string) => void; selected: string | null }) {
  if (turnos.length === 0) return <Empty texto="No hay turnos para esta fecha y filtros." />
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--bg-2)' }}>
            <th style={th}>Hora</th>
            <th style={th}>Paciente</th>
            <th style={th}>Profesional</th>
            <th style={th}>Consultorio</th>
            <th style={th}>Estado</th>
            <th style={th}>Cobertura</th>
            <th style={th}>Alertas</th>
          </tr>
        </thead>
        <tbody>
          {turnos.map((t) => (
            <tr key={t.id}
              onClick={() => onSelect(t.id)}
              style={{
                borderTop: '1px solid var(--border)', cursor: 'pointer',
                background: selected === t.id ? 'var(--teal-l)' : 'transparent',
              }}
            >
              <td style={td}><strong>{format(new Date(t.fecha_hora), 'HH:mm')}</strong></td>
              <td style={td}>
                <div style={{ fontWeight: 500 }}>{t.paciente.nombre} {t.paciente.apellido}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>DNI {t.paciente.dni}</div>
              </td>
              <td style={td}>
                <div>{t.profesional.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.profesional.especialidad}</div>
              </td>
              <td style={td}>{t.consultorio?.nombre ?? '—'}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.sede.nombre}</div></td>
              <td style={td}><EstadoBadge estado={t.estado} /></td>
              <td style={td}>{t.cobertura?.nombre ?? <span style={{ color: 'var(--muted)' }}>Particular</span>}</td>
              <td style={td}><FlagsRow turno={t} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Panel lateral detalle + acciones
// ────────────────────────────────────────────────────────────────
function DetalleTurnoPanel({ turno, onClose }: { turno: TurnoOp; onClose: () => void }) {
  const cambiar = useCambiarEstadoTurno()

  async function transicion(nuevoEstado: EstadoTurno, motivo?: string) {
    try {
      await cambiar.mutateAsync({ id: turno.id, estado: nuevoEstado, motivo })
    } catch (e: any) {
      alert(e?.message ?? 'No se pudo cambiar el estado')
    }
  }

  // Transiciones permitidas espejando TRANSICIONES del backend
  const acciones: { label: string; estado: EstadoTurno; tone?: 'primary' | 'salud' | 'danger' | 'secondary'; promptMotivo?: boolean }[] = []
  if (turno.estado === 'PENDIENTE' || turno.estado === 'PENDIENTE_PAGO_MP' || turno.estado === 'PENDIENTE_VALIDACION_MANUAL') {
    acciones.push({ label: 'Confirmar', estado: 'CONFIRMADO', tone: 'primary' })
  }
  if (turno.estado === 'CONFIRMADO') {
    acciones.push({ label: 'Marcar llegada', estado: 'EN_SALA_ESPERA', tone: 'primary' })
  }
  if (turno.estado === 'EN_SALA_ESPERA') {
    acciones.push({ label: 'Iniciar atención', estado: 'EN_ATENCION', tone: 'primary' })
  }
  if (turno.estado === 'EN_ATENCION') {
    acciones.push({ label: 'Finalizar atención', estado: 'ATENDIDO', tone: 'salud' })
  }
  if (['PENDIENTE', 'CONFIRMADO', 'EN_SALA_ESPERA'].includes(turno.estado)) {
    acciones.push({ label: 'Marcar ausente', estado: 'AUSENTE', tone: 'secondary' })
  }
  if (!['ATENDIDO', 'CANCELADO', 'AUSENTE', 'VENCIDO'].includes(turno.estado)) {
    acciones.push({ label: 'Cancelar', estado: 'CANCELADO', tone: 'danger', promptMotivo: true })
  }

  return (
    <aside style={{
      width: 380, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: 18, overflowY: 'auto', maxHeight: 'calc(100vh - var(--top-h) - 48px)', position: 'sticky', top: 12,
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Turno</div>
          <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--noir)' }}>
            {format(new Date(turno.fecha_hora), "HH:mm")} · {turno.duracion_min} min
          </div>
        </div>
        <button onClick={onClose} style={{ ...btnIcon, height: 28, width: 28 }}>×</button>
      </div>

      <EstadoBadge estado={turno.estado} large />

      {/* Paciente */}
      <Section titulo="Paciente">
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--noir)' }}>
          {turno.paciente.nombre} {turno.paciente.apellido}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>DNI {turno.paciente.dni}</div>
        {turno.paciente.telefono && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Tel. {turno.paciente.telefono}</div>}
        {turno.paciente.observaciones && (
          <div style={{ fontSize: 12, color: 'var(--noir)', marginTop: 6, padding: 8, background: 'var(--bg-2)', borderRadius: 6 }}>
            <strong>Obs:</strong> {turno.paciente.observaciones}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Link href={`/admin/pacientes/${turno.paciente.id}`} style={{ ...btnSecondary, textDecoration: 'none' }}>Ver paciente</Link>
          <Link href={`/admin/historia-clinica?paciente_id=${turno.paciente.id}`} style={{ ...btnSecondary, textDecoration: 'none' }}>Historia clínica</Link>
        </div>
      </Section>

      {/* Cobertura + saldo */}
      <Section titulo="Cobertura y saldo">
        <Row label="Cobertura" value={turno.cobertura ? `${turno.cobertura.nombre} (${turno.cobertura.tipo})` : 'Particular'} />
        {turno.cobertura?.numero_afiliado && <Row label="Afiliado" value={turno.cobertura.numero_afiliado} />}
        {turno.deuda_saldo > 0 && <Row label="Deuda" value={`$${turno.deuda_saldo.toLocaleString('es-AR')}`} valueColor="var(--danger)" />}
        {turno.comprobante_saldo > 0 && <Row label="Saldo comprobante" value={`$${turno.comprobante_saldo.toLocaleString('es-AR')}`} valueColor="var(--danger)" />}
      </Section>

      {/* Profesional */}
      <Section titulo="Profesional">
        <Row label="Médico" value={turno.profesional.nombre} />
        {turno.profesional.especialidad && <Row label="Especialidad" value={turno.profesional.especialidad} />}
        <Row label="Lugar" value={turno.consultorio ? `${turno.consultorio.nombre} · ${turno.sede.nombre}` : turno.sede.nombre} />
        {turno.prestacion && <Row label="Prestación" value={turno.prestacion.nombre} />}
        {turno.motivo_consulta && <Row label="Motivo" value={turno.motivo_consulta} />}
        {turno.modalidad === 'VIRTUAL' && <Badge tone="info" text="Telemedicina" />}
      </Section>

      {/* Timeline */}
      <Section titulo="Timeline">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
          <Row label="Programado" value={format(new Date(turno.fecha_hora), "HH:mm")} />
          {turno.ingreso_sala_at && <Row label="Llegada" value={format(new Date(turno.ingreso_sala_at), "HH:mm")} />}
          {turno.inicio_atencion_at && <Row label="Inicio atención" value={format(new Date(turno.inicio_atencion_at), "HH:mm")} />}
          {turno.fin_atencion_at && <Row label="Fin atención" value={format(new Date(turno.fin_atencion_at), "HH:mm")} />}
          {turno.cancelado_motivo && <Row label="Motivo cancel." value={turno.cancelado_motivo} valueColor="var(--danger)" />}
        </div>
      </Section>

      {/* Acciones */}
      {acciones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Acciones</div>
          {acciones.map((a) => (
            <button
              key={a.estado}
              disabled={cambiar.isPending}
              onClick={() => {
                if (a.promptMotivo) {
                  const m = prompt('Motivo de cancelación:')
                  if (!m) return
                  transicion(a.estado, m)
                } else {
                  transicion(a.estado)
                }
              }}
              style={
                a.tone === 'primary' ? btnPrimaryFull :
                a.tone === 'salud'   ? btnSaludFull :
                a.tone === 'danger'  ? btnDangerFull :
                                       btnSecondaryFull
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Cobrar / reprogramar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
        <Link href={`/admin/facturacion?paciente_id=${turno.paciente.id}&turno_id=${turno.id}`} style={{ ...btnSecondaryFull, textDecoration: 'none', textAlign: 'center' }}>
          Cobrar
        </Link>
        <Link href={`/admin/agenda?paciente_id=${turno.paciente.id}&prestacion_id=${turno.prestacion?.id ?? ''}`} style={{ ...btnSecondaryFull, textDecoration: 'none', textAlign: 'center' }}>
          Reprogramar
        </Link>
      </div>
    </aside>
  )
}

// ────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ────────────────────────────────────────────────────────────────
function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{titulo}</div>
      {children}
    </div>
  )
}

function SelectFilter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...inputBase, height: 36, paddingRight: 28, fontWeight: value ? 600 : 400,
        color: value ? 'var(--noir)' : 'var(--muted)',
      }}
    >
      <option value="">{label}: Todos</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Badge({ text, tone, size = 'sm' }: { text: string; tone: 'salud' | 'warning' | 'danger' | 'info'; size?: 'xs' | 'sm' }) {
  const bg = { salud: 'var(--salud-l)', warning: 'var(--warning-l)', danger: 'var(--danger-l)', info: 'var(--info-l)' }[tone]
  const fg = { salud: 'var(--salud)',  warning: 'var(--warning)',  danger: 'var(--danger)',  info: 'var(--info)'  }[tone]
  return (
    <span style={{
      padding: size === 'xs' ? '1px 6px' : '2px 8px', borderRadius: 10,
      background: bg, color: fg, fontSize: size === 'xs' ? 10 : 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>{text}</span>
  )
}

function EstadoBadge({ estado, large }: { estado: EstadoTurno; large?: boolean }) {
  const map = COLUMNAS.find((c) => c.id.includes(estado))!
  return (
    <span style={{
      padding: large ? '6px 12px' : '3px 10px',
      background: map.bg, color: map.fg,
      borderRadius: 12, fontSize: large ? 12 : 11, fontWeight: 600, display: 'inline-block',
    }}>{ESTADO_LABELS[estado]}</span>
  )
}

function Empty({ texto }: { texto: string }) {
  return <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', fontSize: 13, background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>{texto}</div>
}

function shiftFecha(actual: string, set: (s: string) => void, delta: number) {
  const d = new Date(`${actual}T12:00:00`)
  d.setDate(d.getDate() + delta)
  set(d.toISOString().slice(0, 10))
}

// ────────────────────────────────────────────────────────────────
// Estilos compartidos
// ────────────────────────────────────────────────────────────────
const inputBase: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13,
  background: 'var(--surface)', color: 'var(--noir)',
}
const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)' }
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: 'var(--noir)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
const btnLink: React.CSSProperties = { padding: '8px 4px', background: 'transparent', color: 'var(--teal)', border: 'none', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }
const btnIcon: React.CSSProperties = { padding: 0, width: 36, height: 36, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 16, color: 'var(--noir)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const btnPrimaryFull: React.CSSProperties = { ...btnPrimary, width: '100%', padding: '10px 14px' }
const btnSaludFull:   React.CSSProperties = { ...btnPrimary, width: '100%', padding: '10px 14px', background: 'var(--salud)' }
const btnDangerFull:  React.CSSProperties = { ...btnPrimary, width: '100%', padding: '10px 14px', background: 'var(--danger)' }
const btnSecondaryFull: React.CSSProperties = { ...btnSecondary, width: '100%', padding: '10px 14px' }
