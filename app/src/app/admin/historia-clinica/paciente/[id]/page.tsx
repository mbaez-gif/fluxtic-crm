'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  useHistoriaClinica, useCrearEvolucion, useFirmarEvolucion,
  useCrearAntecedente, useCrearAlergia, useCrearMedicacion,
  useEliminarItemHc, usePlantillasHc, useProfesionales,
} from '@/hooks/useApi'

type Tab = 'evoluciones' | 'antecedentes' | 'alergias' | 'medicacion' | 'diagnosticos'

export default function HistoriaClinicaPacientePage() {
  const params = useParams<{ id: string }>()
  const pacienteId = params?.id ?? ''
  const { data: hc, isLoading, error } = useHistoriaClinica(pacienteId)
  const [tab, setTab] = useState<Tab>('evoluciones')

  if (isLoading) return <div style={{ padding: 24 }}>Cargando historia clínica...</div>
  if (error || !hc) return <div style={{ padding: 24, color: 'var(--danger)' }}>Error: {(error as any)?.message ?? 'no se pudo cargar la HC'}</div>

  const paciente = hc.paciente

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <Link href={`/admin/pacientes/${pacienteId}`} style={{ fontSize: 13, color: 'var(--muted)' }}>← Volver a la ficha</Link>

      {/* Banner auditoría */}
      <div style={{
        marginTop: 12, padding: '12px 16px',
        background: 'var(--warning-l)', color: 'var(--warning)', borderRadius: 8,
        borderLeft: '4px solid var(--warning)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>🔒</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Acceso a historia clínica registrado</div>
          <div style={{ fontSize: 12 }}>
            Esta sesión queda asentada en el log de auditoría con tu usuario, IP y fecha. Toda modificación se firma con tu identidad.
          </div>
        </div>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--noir)', marginTop: 16, marginBottom: 2 }}>
        Historia clínica · {paciente.apellido}, {paciente.nombre}
      </h1>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>DNI {paciente.dni} · HC #{hc.historia.id.slice(-8).toUpperCase()}</div>

      {/* Alergias críticas siempre visibles */}
      {hc.alergias.filter((a: any) => a.severidad === 'CRITICA' || a.severidad === 'SEVERA').length > 0 && (
        <div style={{
          padding: '12px 16px', background: 'var(--danger-l)', color: 'var(--danger)',
          borderRadius: 8, marginBottom: 16, borderLeft: '4px solid var(--danger)',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>⚠ Alergias importantes</div>
          <div style={{ fontSize: 12 }}>
            {hc.alergias.filter((a: any) => ['CRITICA', 'SEVERA'].includes(a.severidad)).map((a: any) => `${a.sustancia} (${a.severidad})`).join(' · ')}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {([
          ['evoluciones', `Evoluciones (${hc.evoluciones.length})`],
          ['antecedentes', `Antecedentes (${hc.antecedentes.length})`],
          ['alergias', `Alergias (${hc.alergias.length})`],
          ['medicacion', `Medicación habitual (${hc.medicaciones.length})`],
          ['diagnosticos', `Diagnósticos (${hc.diagnosticos.length})`],
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

      {tab === 'evoluciones' && <TabEvoluciones pacienteId={pacienteId} evoluciones={hc.evoluciones} />}
      {tab === 'antecedentes' && <TabAntecedentes pacienteId={pacienteId} antecedentes={hc.antecedentes} />}
      {tab === 'alergias' && <TabAlergias pacienteId={pacienteId} alergias={hc.alergias} />}
      {tab === 'medicacion' && <TabMedicacion pacienteId={pacienteId} medicaciones={hc.medicaciones} />}
      {tab === 'diagnosticos' && <TabDiagnosticos diagnosticos={hc.diagnosticos} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Evoluciones (timeline + form SOAP con plantilla)
// ════════════════════════════════════════════════════════════════

function TabEvoluciones({ pacienteId, evoluciones }: { pacienteId: string; evoluciones: any[] }) {
  const [abierto, setAbierto] = useState(false)
  const [profesionalId, setProfesionalId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [subjetivo, setSubjetivo] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [analisis, setAnalisis] = useState('')
  const [plan, setPlan] = useState('')
  const [plantillaId, setPlantillaId] = useState('')

  const profs = useProfesionales()
  const profSeleccionado = profs.data?.find((p: any) => p.id === profesionalId)
  const plantillas = usePlantillasHc(profSeleccionado?.especialidad_id)
  const crear = useCrearEvolucion()
  const firmar = useFirmarEvolucion()

  function aplicarPlantilla(pId: string) {
    setPlantillaId(pId)
    const p = plantillas.data?.find((x: any) => x.id === pId)
    if (p?.texto_base) {
      setSubjetivo(p.texto_base)
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!profesionalId) return
    await crear.mutateAsync({
      paciente_id: pacienteId,
      profesional_id: profesionalId,
      motivo_consulta: motivo || null,
      subjetivo: subjetivo || null,
      objetivo: objetivo || null,
      analisis: analisis || null,
      plan: plan || null,
    })
    setAbierto(false)
    setMotivo(''); setSubjetivo(''); setObjetivo(''); setAnalisis(''); setPlan('')
  }

  return (
    <div>
      {!abierto && (
        <button onClick={() => setAbierto(true)} style={{ ...btnPrimary, marginBottom: 16 }}>
          + Nueva evolución
        </button>
      )}

      {abierto && (
        <form onSubmit={guardar} style={{
          background: 'var(--surface)', border: '1px solid var(--teal)',
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--noir)' }}>Nueva evolución (formato SOAP)</h3>
            <button type="button" onClick={() => setAbierto(false)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <Field label="Profesional *">
              <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} required style={input}>
                <option value="">Seleccionar profesional...</option>
                {profs.data?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.usuario.apellido}, {p.usuario.nombre} · {p.especialidad?.nombre}</option>
                ))}
              </select>
            </Field>
            <Field label="Plantilla por especialidad">
              <select value={plantillaId} onChange={(e) => aplicarPlantilla(e.target.value)} style={input} disabled={!profesionalId || !plantillas.data?.length}>
                <option value="">Sin plantilla</option>
                {plantillas.data?.map((p: any) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Motivo de consulta">
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. control anual" style={input} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Subjetivo (S) — relato del paciente">
              <textarea value={subjetivo} onChange={(e) => setSubjetivo(e.target.value)} rows={4} style={{ ...input, resize: 'vertical' }} />
            </Field>
            <Field label="Objetivo (O) — examen físico, signos vitales">
              <textarea value={objetivo} onChange={(e) => setObjetivo(e.target.value)} rows={4} style={{ ...input, resize: 'vertical' }} />
            </Field>
            <Field label="Análisis (A) — diagnóstico / impresión">
              <textarea value={analisis} onChange={(e) => setAnalisis(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
            </Field>
            <Field label="Plan (P) — tratamiento, controles, derivaciones">
              <textarea value={plan} onChange={(e) => setPlan(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" onClick={() => setAbierto(false)} style={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={crear.isPending} style={btnPrimary}>
              {crear.isPending ? 'Guardando...' : 'Guardar evolución'}
            </button>
          </div>
        </form>
      )}

      {/* Timeline */}
      {evoluciones.length === 0 ? (
        <Card><div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin evoluciones registradas. Creá la primera arriba.</div></Card>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 8, top: 8, bottom: 8, width: 2, background: 'var(--border-2)' }} />
          {evoluciones.map((e: any) => (
            <div key={e.id} style={{ position: 'relative', marginBottom: 16 }}>
              <div style={{
                position: 'absolute', left: -22, top: 14, width: 14, height: 14,
                borderRadius: '50%', background: e.firmado_at ? 'var(--salud)' : 'var(--warning)',
                border: '3px solid var(--surface)',
              }} />
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--noir)' }}>
                      {format(new Date(e.fecha), "EEEE d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {e.profesional.usuario.apellido}, {e.profesional.usuario.nombre} · {e.profesional.especialidad?.nombre}
                    </div>
                  </div>
                  {e.firmado_at ? (
                    <span style={{ padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: 'var(--salud-l)', color: 'var(--salud)' }}>FIRMADA</span>
                  ) : (
                    <button onClick={() => firmar.mutate(e.id)} disabled={firmar.isPending} style={{ padding: '4px 10px', background: 'var(--warning)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                      Firmar
                    </button>
                  )}
                </div>
                {e.motivo_consulta && <Section label="Motivo" texto={e.motivo_consulta} />}
                {e.subjetivo && <Section label="S — Subjetivo" texto={e.subjetivo} />}
                {e.objetivo && <Section label="O — Objetivo" texto={e.objetivo} />}
                {e.analisis && <Section label="A — Análisis" texto={e.analisis} />}
                {e.plan && <Section label="P — Plan" texto={e.plan} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Section({ label, texto }: { label: string; texto: string }) {
  return (
    <div style={{ marginTop: 8, fontSize: 13 }}>
      <span style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginRight: 6 }}>{label}:</span>
      <span style={{ color: 'var(--noir)', whiteSpace: 'pre-wrap' }}>{texto}</span>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Antecedentes
// ════════════════════════════════════════════════════════════════

function TabAntecedentes({ pacienteId, antecedentes }: { pacienteId: string; antecedentes: any[] }) {
  const [tipo, setTipo] = useState('PERSONAL')
  const [descripcion, setDescripcion] = useState('')
  const [cie10, setCie10] = useState('')
  const crear = useCrearAntecedente()
  const eliminar = useEliminarItemHc()

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!descripcion) return
    await crear.mutateAsync({ paciente_id: pacienteId, tipo, descripcion, cie10: cie10 || null })
    setDescripcion(''); setCie10('')
  }

  return (
    <div>
      <Card titulo="Agregar antecedente">
        <form onSubmit={agregar} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 10 }}>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={input}>
            <option value="PERSONAL">Personal</option>
            <option value="FAMILIAR">Familiar</option>
            <option value="QUIRURGICO">Quirúrgico</option>
            <option value="OBSTETRICO">Obstétrico</option>
            <option value="GINECOLOGICO">Ginecológico</option>
            <option value="TRAUMATICO">Traumático</option>
            <option value="OTRO">Otro</option>
          </select>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del antecedente" required style={input} />
          <input value={cie10} onChange={(e) => setCie10(e.target.value)} placeholder="CIE-10 (opcional)" style={input} />
          <button type="submit" disabled={crear.isPending} style={{ ...btnPrimary, gridColumn: 'span 3' }}>
            {crear.isPending ? 'Guardando...' : 'Agregar antecedente'}
          </button>
        </form>
      </Card>

      {antecedentes.length === 0 ? (
        <Card><div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin antecedentes cargados.</div></Card>
      ) : antecedentes.map((a: any) => (
        <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <span style={{ padding: '2px 8px', borderRadius: 12, background: 'var(--bg-2)', fontSize: 10, fontWeight: 600, color: 'var(--noir)', marginRight: 10 }}>{a.tipo}</span>
            <span style={{ fontSize: 13 }}>{a.descripcion}</span>
            {a.cie10 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-m)' }}>[{a.cie10}]</span>}
          </div>
          <button onClick={async () => {
            const m = window.prompt('Motivo de eliminación:')
            if (m) eliminar.mutate({ entity: 'antecedente', id: a.id, motivo: m })
          }} style={iconBtn}>quitar</button>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Alergias
// ════════════════════════════════════════════════════════════════

function TabAlergias({ pacienteId, alergias }: { pacienteId: string; alergias: any[] }) {
  const [sustancia, setSustancia] = useState('')
  const [severidad, setSeveridad] = useState('LEVE')
  const [reaccion, setReaccion] = useState('')
  const crear = useCrearAlergia()
  const eliminar = useEliminarItemHc()

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!sustancia) return
    await crear.mutateAsync({ paciente_id: pacienteId, sustancia, severidad, reaccion: reaccion || null })
    setSustancia(''); setReaccion('')
  }

  const colores: Record<string, { bg: string; fg: string }> = {
    LEVE: { bg: 'var(--bg-2)', fg: 'var(--noir)' },
    MODERADA: { bg: 'var(--warning-l)', fg: 'var(--warning)' },
    SEVERA: { bg: 'var(--danger-l)', fg: 'var(--danger)' },
    CRITICA: { bg: 'var(--danger-l)', fg: 'var(--danger)' },
  }

  return (
    <div>
      <Card titulo="Agregar alergia">
        <form onSubmit={agregar} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 10 }}>
          <input value={sustancia} onChange={(e) => setSustancia(e.target.value)} placeholder="Sustancia (ej. Penicilina)" required style={input} />
          <select value={severidad} onChange={(e) => setSeveridad(e.target.value)} style={input}>
            <option value="LEVE">Leve</option>
            <option value="MODERADA">Moderada</option>
            <option value="SEVERA">Severa</option>
            <option value="CRITICA">Crítica</option>
          </select>
          <input value={reaccion} onChange={(e) => setReaccion(e.target.value)} placeholder="Reacción (opcional)" style={input} />
          <button type="submit" disabled={crear.isPending} style={{ ...btnPrimary, gridColumn: 'span 3' }}>
            {crear.isPending ? 'Guardando...' : 'Agregar alergia'}
          </button>
        </form>
      </Card>

      {alergias.length === 0 ? (
        <Card><div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin alergias registradas.</div></Card>
      ) : alergias.map((a: any) => {
        const c = colores[a.severidad] ?? { bg: 'var(--bg-2)', fg: 'var(--noir)' }
        return (
          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: c.bg, color: c.fg, borderRadius: 8, marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{a.sustancia}</span>
              <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', background: 'rgba(255,255,255,.5)', borderRadius: 10, fontWeight: 600 }}>{a.severidad}</span>
              {a.reaccion && <div style={{ fontSize: 12, marginTop: 2, opacity: .85 }}>{a.reaccion}</div>}
            </div>
            <button onClick={async () => {
              const m = window.prompt('Motivo de eliminación:')
              if (m) eliminar.mutate({ entity: 'alergia', id: a.id, motivo: m })
            }} style={{ ...iconBtn, color: 'inherit' }}>quitar</button>
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Medicación habitual
// ════════════════════════════════════════════════════════════════

function TabMedicacion({ pacienteId, medicaciones }: { pacienteId: string; medicaciones: any[] }) {
  const [med, setMed] = useState('')
  const [dosis, setDosis] = useState('')
  const [frecuencia, setFrecuencia] = useState('')
  const [via, setVia] = useState('')
  const [motivo, setMotivo] = useState('')
  const crear = useCrearMedicacion()
  const eliminar = useEliminarItemHc()

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    if (!med) return
    await crear.mutateAsync({ paciente_id: pacienteId, medicamento: med, dosis: dosis || null, frecuencia: frecuencia || null, via: via || null, motivo: motivo || null })
    setMed(''); setDosis(''); setFrecuencia(''); setVia(''); setMotivo('')
  }

  return (
    <div>
      <Card titulo="Agregar medicación habitual">
        <form onSubmit={agregar} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10 }}>
          <input value={med} onChange={(e) => setMed(e.target.value)} placeholder="Medicamento *" required style={input} />
          <input value={dosis} onChange={(e) => setDosis(e.target.value)} placeholder="Dosis (ej. 10mg)" style={input} />
          <input value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)} placeholder="Frecuencia" style={input} />
          <input value={via} onChange={(e) => setVia(e.target.value)} placeholder="Vía" style={input} />
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo de la medicación (opcional)" style={{ ...input, gridColumn: 'span 4' }} />
          <button type="submit" disabled={crear.isPending} style={{ ...btnPrimary, gridColumn: 'span 4' }}>
            {crear.isPending ? 'Guardando...' : 'Agregar medicación'}
          </button>
        </form>
      </Card>

      {medicaciones.length === 0 ? (
        <Card><div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin medicación habitual cargada.</div></Card>
      ) : medicaciones.map((m: any) => (
        <div key={m.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--noir)' }}>{m.medicamento}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {[m.dosis, m.frecuencia, m.via].filter(Boolean).join(' · ') || 'Sin posología'}
              {m.motivo && ` · Motivo: ${m.motivo}`}
            </div>
          </div>
          <button onClick={async () => {
            const mot = window.prompt('Motivo de eliminación:')
            if (mot) eliminar.mutate({ entity: 'medicacion', id: m.id, motivo: mot })
          }} style={iconBtn}>quitar</button>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Diagnósticos (read-only — se cargan vía evoluciones)
// ════════════════════════════════════════════════════════════════

function TabDiagnosticos({ diagnosticos }: { diagnosticos: any[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Los diagnósticos se cargan desde las evoluciones clínicas. Aquí ves el listado consolidado.
      </div>
      {diagnosticos.length === 0 ? (
        <Card><div style={{ color: 'var(--muted)', fontSize: 13 }}>Sin diagnósticos registrados.</div></Card>
      ) : diagnosticos.map((d: any) => (
        <div key={d.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{d.descripcion}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {format(new Date(d.fecha), "d MMM yyyy", { locale: es })} {d.cie10 && `· [${d.cie10}]`}
          </div>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// UI helpers
// ════════════════════════════════════════════════════════════════

function Card({ titulo, children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      {titulo && <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{titulo}</div>}
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)' }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }
