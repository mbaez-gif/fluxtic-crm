'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  useBuscarPacientes, useBuscarMedicamentos,
  useProfesionales, useCheckAlertasReceta,
  useCrearReceta, useFirmarReceta, useEnviarReceta,
} from '@/hooks/useApi'

interface ItemForm {
  medicamento_id: string | null
  descripcion: string
  presentacion: string
  cantidad: string
  posologia: string
  duracion: string
  via: string
  observaciones: string
}

const emptyItem: ItemForm = { medicamento_id: null, descripcion: '', presentacion: '', cantidad: '', posologia: '', duracion: '', via: 'Oral', observaciones: '' }

export default function NuevaRecetaPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Cargando...</div>}>
      <NuevaRecetaContent />
    </Suspense>
  )
}

function NuevaRecetaContent() {
  const searchParams = useSearchParams()
  const pacienteInicial = searchParams.get('paciente_id') ?? ''
  const router = useRouter()

  const [pacienteId, setPacienteId] = useState(pacienteInicial)
  const [pacienteLabel, setPacienteLabel] = useState('')
  const [busqPac, setBusqPac] = useState('')
  const [profesionalId, setProfesionalId] = useState('')
  const [tipo, setTipo] = useState('RECETA')
  const [diagnosticoCie10, setDiagnosticoCie10] = useState('')
  const [diagnosticoTexto, setDiagnosticoTexto] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<ItemForm[]>([{ ...emptyItem }])
  const [recetaId, setRecetaId] = useState<string | null>(null)
  const [alertas, setAlertas] = useState<any[]>([])

  const pacientes = useBuscarPacientes(busqPac)
  const profs = useProfesionales()
  const crear = useCrearReceta()
  const firmar = useFirmarReceta()
  const enviar = useEnviarReceta()
  const checkAlertas = useCheckAlertasReceta()

  // Pre-cargar paciente si vino por query
  useEffect(() => {
    if (pacienteInicial && !pacienteLabel) {
      // Fetch quick info via search trick
      setBusqPac(pacienteInicial.slice(-6))
    }
  }, [pacienteInicial, pacienteLabel])

  function actualizarItem(i: number, patch: Partial<ItemForm>) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }

  async function chequearAlertas() {
    const ids = items.map((it) => it.medicamento_id).filter((x): x is string => !!x)
    if (!pacienteId || ids.length === 0) {
      alert('Necesitás un paciente y al menos un medicamento del vademécum')
      return
    }
    const result = await checkAlertas.mutateAsync({ paciente_id: pacienteId, medicamento_ids: ids })
    setAlertas(result.alertas)
    if (result.total === 0) {
      alert('Sin alertas de alergias ni interacciones detectadas ✓')
    }
  }

  async function crearBorrador(e: React.FormEvent) {
    e.preventDefault()
    if (!pacienteId || !profesionalId || items.some((it) => !it.descripcion)) {
      alert('Faltan datos: paciente, profesional o ítems')
      return
    }
    const body: any = {
      paciente_id: pacienteId,
      profesional_id: profesionalId,
      tipo,
      diagnostico_cie10: diagnosticoCie10 || null,
      diagnostico_texto: diagnosticoTexto || null,
      observaciones: observaciones || null,
      items: items.map((it) => ({
        medicamento_id: it.medicamento_id,
        descripcion: it.descripcion,
        presentacion: it.presentacion || null,
        cantidad: it.cantidad || null,
        posologia: it.posologia || null,
        duracion: it.duracion || null,
        via: it.via || null,
        observaciones: it.observaciones || null,
      })),
    }
    const r: any = await crear.mutateAsync(body)
    setRecetaId(r.id)
  }

  async function handleFirmar() {
    if (!recetaId) return
    await firmar.mutateAsync(recetaId)
    alert('Receta firmada ✓')
  }

  async function handleEnviar(canal: 'WHATSAPP' | 'EMAIL') {
    if (!recetaId) return
    await enviar.mutateAsync({ id: recetaId, canal })
    alert(`Receta enviada por ${canal} ✓`)
    router.push('/admin/pacientes/' + pacienteId)
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Link href="/admin/pacientes" style={{ fontSize: 13, color: 'var(--muted)' }}>← Pacientes</Link>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginTop: 8, marginBottom: 4 }}>Nueva receta electrónica</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Las recetas firmadas se firman con SHA-256 y se envían por WhatsApp o email vía n8n.
      </p>

      <form onSubmit={crearBorrador}>
        <Card titulo="Paciente y profesional">
          {pacienteId ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--teal-l)', borderRadius: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--teal-d)', fontWeight: 500 }}>{pacienteLabel || `Paciente ${pacienteId.slice(-8)}`}</span>
              <button type="button" onClick={() => { setPacienteId(''); setPacienteLabel(''); setBusqPac('') }} style={iconBtn}>cambiar</button>
            </div>
          ) : (
            <>
              <input value={busqPac} onChange={(e) => setBusqPac(e.target.value)} placeholder="Buscar paciente por DNI, apellido..." style={input} />
              {busqPac.length >= 2 && pacientes.data && pacientes.data.data.length > 0 && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 6, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
                  {pacientes.data.data.slice(0, 10).map((p: any) => (
                    <div key={p.id} onClick={() => { setPacienteId(p.id); setPacienteLabel(`${p.apellido}, ${p.nombre} · DNI ${p.dni}`) }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-2)' }}>
                      {p.apellido}, {p.nombre} <span style={{ color: 'var(--muted)' }}>· {p.dni}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <Field label="Profesional *">
              <select value={profesionalId} onChange={(e) => setProfesionalId(e.target.value)} required style={input}>
                <option value="">Seleccionar...</option>
                {profs.data?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.usuario.apellido}, {p.usuario.nombre} · {p.especialidad?.nombre}</option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de orden">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={input}>
                <option value="RECETA">Receta</option>
                <option value="ORDEN_ESTUDIO">Orden de estudio</option>
                <option value="CERTIFICADO">Certificado médico</option>
                <option value="INDICACION_MEDICA">Indicación médica</option>
              </select>
            </Field>
          </div>
        </Card>

        <Card titulo="Diagnóstico">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            <Field label="CIE-10"><input value={diagnosticoCie10} onChange={(e) => setDiagnosticoCie10(e.target.value)} placeholder="ej. J45.0" style={input} /></Field>
            <Field label="Diagnóstico (texto)"><input value={diagnosticoTexto} onChange={(e) => setDiagnosticoTexto(e.target.value)} placeholder="ej. Asma persistente" style={input} /></Field>
          </div>
        </Card>

        <Card titulo="Indicaciones">
          {items.map((it, i) => (
            <ItemEditor key={i} index={i} item={it} onChange={(patch) => actualizarItem(i, patch)} onRemove={() => setItems((arr) => arr.filter((_, idx) => idx !== i))} canRemove={items.length > 1} />
          ))}
          <button type="button" onClick={() => setItems((arr) => [...arr, { ...emptyItem }])} style={{ ...btnSecondary, fontSize: 12 }}>+ Agregar indicación</button>
        </Card>

        <Card titulo="Observaciones generales">
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
        </Card>

        {/* Alertas */}
        {alertas.length > 0 && (
          <div style={{
            background: 'var(--danger-l)', border: '1px solid var(--danger)',
            borderRadius: 12, padding: 14, marginBottom: 12, color: 'var(--danger)',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠ {alertas.length} alerta{alertas.length > 1 ? 's' : ''} detectada{alertas.length > 1 ? 's' : ''}</div>
            {alertas.map((a, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>
                <strong>{a.tipo}</strong> ({a.severidad}) — {a.mensaje}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={chequearAlertas} disabled={checkAlertas.isPending} style={btnSecondary}>
            {checkAlertas.isPending ? 'Chequeando...' : '🔍 Chequear alergias e interacciones'}
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            {!recetaId && (
              <button type="submit" disabled={crear.isPending} style={btnPrimary}>
                {crear.isPending ? 'Creando...' : 'Crear borrador'}
              </button>
            )}
            {recetaId && (
              <>
                <button type="button" onClick={handleFirmar} disabled={firmar.isPending} style={btnPrimary}>
                  {firmar.isPending ? 'Firmando...' : '✍ Firmar receta'}
                </button>
                <button type="button" onClick={() => handleEnviar('WHATSAPP')} disabled={enviar.isPending} style={{ ...btnPrimary, background: 'var(--salud)' }}>
                  Enviar por WhatsApp
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

function ItemEditor({ index, item, onChange, onRemove, canRemove }: {
  index: number; item: ItemForm; onChange: (p: Partial<ItemForm>) => void; onRemove: () => void; canRemove: boolean
}) {
  const [busq, setBusq] = useState('')
  const meds = useBuscarMedicamentos(busq)

  function seleccionar(m: any) {
    onChange({
      medicamento_id: m.id,
      descripcion: m.nombre_comercial,
      presentacion: m.presentacion ?? '',
      via: m.via_admin ?? item.via,
    })
    setBusq('')
  }

  return (
    <div style={{ background: 'var(--bg-2)', padding: 12, borderRadius: 8, marginBottom: 10, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Indicación {index + 1}</span>
        {canRemove && <button type="button" onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>quitar</button>}
      </div>

      {!item.medicamento_id && (
        <>
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar en vademécum por nombre o principio activo (≥2 caract.)" style={{ ...input, marginBottom: 8 }} />
          {busq.length >= 2 && meds.data && meds.data.length > 0 && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, maxHeight: 180, overflowY: 'auto', background: 'var(--surface)' }}>
              {meds.data.map((m: any) => (
                <div key={m.id} onClick={() => seleccionar(m)} style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border-2)' }}>
                  <strong>{m.nombre_comercial}</strong> <span style={{ color: 'var(--muted)' }}>· {m.principio_activo}</span>
                  {m.presentacion && <span style={{ color: 'var(--muted)' }}> · {m.presentacion}</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>O escribí descripción libre abajo (sin chequeo de interacciones)</div>
        </>
      )}

      {item.medicamento_id && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--teal-l)', borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--teal-d)' }}>✓ Del vademécum: {item.descripcion}</span>
          <button type="button" onClick={() => onChange({ medicamento_id: null })} style={{ background: 'none', border: 'none', color: 'var(--teal-d)', fontSize: 11, cursor: 'pointer' }}>quitar</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
        <input value={item.descripcion} onChange={(e) => onChange({ descripcion: e.target.value })} placeholder="Descripción del medicamento *" required style={input} />
        <input value={item.presentacion} onChange={(e) => onChange({ presentacion: e.target.value })} placeholder="Presentación" style={input} />
        <input value={item.cantidad} onChange={(e) => onChange({ cantidad: e.target.value })} placeholder="Cantidad" style={input} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 8 }}>
        <input value={item.posologia} onChange={(e) => onChange({ posologia: e.target.value })} placeholder="Posología (ej. 1 comp/8hs)" style={input} />
        <input value={item.duracion} onChange={(e) => onChange({ duracion: e.target.value })} placeholder="Duración (ej. 7 días)" style={input} />
        <input value={item.via} onChange={(e) => onChange({ via: e.target.value })} placeholder="Vía" style={input} />
      </div>
    </div>
  )
}

function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>{titulo}</div>
      {children}
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)' }
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }
