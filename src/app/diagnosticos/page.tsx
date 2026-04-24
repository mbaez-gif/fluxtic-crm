'use client'

import { useState }       from 'react'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { useCollection }  from '@/lib/hooks/useCollection'
import { createDoc, updateDocById, deleteDocById } from '@/lib/firebase/firestore'
import { PageHeader }     from '@/components/layout/PageHeader'
import { Badge, EmptyState, Spinner } from '@/components/ui'
import type { Lead }      from '@/types'
import { cn }             from '@/lib/utils'
import { format }         from 'date-fns'
import { es }             from 'date-fns/locale'
import type { Timestamp } from 'firebase/firestore'
import {
  Plus, Stethoscope, ExternalLink, Pencil, Trash2,
  FileText, MoreHorizontal, Sparkles, X, Wand2,
  CheckCircle, AlertCircle,
} from 'lucide-react'

interface DiagnosticoCompleto {
  id:            string
  leadId:        string
  titulo:        string
  estado:        'borrador' | 'en_revision' | 'completado'
  responsableId: string
  contactoPrincipal?: string
  fechaDiagnostico?:  string
  consultorACargo?:   string
  duracionReunion?:   string
  s01_q1?: string; s01_q2?: string; s01_q3?: string; s01_q4?: string; s01_q5?: string
  s01_resumen?: string
  s02_q6?: string; s02_q7?: string; s02_q8?: string; s02_q9?: string; s02_q10?: string; s02_q11?: string
  s02_resumen?: string
  s03_q12?: string; s03_q13?: string; s03_q14?: string; s03_q15?: string; s03_q16?: string; s03_q17?: string
  s03_herramientas?: string
  s04_q18?: string; s04_q19?: string; s04_q20?: string; s04_q21?: string
  s04_nivelRiesgo?: 'bajo' | 'medio' | 'alto'
  s05_q22?: string; s05_q23?: string; s05_q24?: string; s05_q25?: string; s05_q26?: string
  s05_resumen?: string
  s06_q27?: string; s06_q28?: string; s06_q29?: string; s06_q30?: string
  s06_urgencia?: number; s06_apertura?: number; s06_capacidad?: number; s06_confianza?: number
  s07_hallazgos?: string
  s07_oportunidades?: string
  s07_serviciosRecomendados?: string
  s07_tipoCliente?: 'abono' | 'proyecto' | 'no_califica'
  s07_proximosPasos?: string
  s07_notas?: string
  creadoEn:      Timestamp
  actualizadoEn: Timestamp
}

function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return (ts as Timestamp).toDate()
}

const ESTADO_BADGE: Record<string, 'default' | 'warning' | 'teal'> = {
  borrador: 'default', en_revision: 'warning', completado: 'teal',
}
const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador', en_revision: 'En revisión', completado: 'Completado',
}

// ── Gemini Analysis Panel ─────────────────────────────────
function GeminiPanel({ onApply }: {
  onApply: (data: Record<string, string>) => void
}) {
  const [notas,     setNotas]     = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result,    setResult]    = useState<Record<string, string> | null>(null)
  const [error,     setError]     = useState('')

  async function handleAnalyze() {
    if (!notas.trim()) return
    setAnalyzing(true)
    setError('')
    setResult(null)

    try {
      const res  = await fetch('/api/gemini', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ notas }),
      })
      const data = await res.json()

      if (data.success && data.parsed) {
        setResult(data.parsed)
      } else {
        setError(data.error ?? 'Error al analizar. Intentá de nuevo.')
      }
    } catch {
      setError('Error de conexión con Gemini.')
    } finally {
      setAnalyzing(false)
    }
  }

  function handleApply() {
    if (!result) return
    // Map Gemini output to form fields
    const mapped: Record<string, string> = {}
    if (result.contexto)    mapped.s01_resumen    = result.contexto
    if (result.procesos)    mapped.s02_resumen    = result.procesos
    if (result.tecnologia)  mapped.s03_herramientas = result.tecnologia
    if (result.seguridad)   mapped.s04_q18        = result.seguridad
    if (result.numeros)     mapped.s05_resumen    = result.numeros
    if (result.cierre)      mapped.s06_q27        = result.cierre
    if (result.hallazgos)   mapped.s07_hallazgos  = result.hallazgos
    if (result.oportunidades) mapped.s07_oportunidades = result.oportunidades
    if (result.proximaAccion) mapped.s07_proximosPasos = result.proximaAccion
    if (result.resumenEjecutivo) mapped.s07_notas = result.resumenEjecutivo
    onApply(mapped)
  }

  return (
    <div className="flux-card border-flux-teal/30 bg-flux-tealGlow/5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-flux-teal" />
        <h3 className="text-sm font-medium text-flux-teal">Asistente Gemini</h3>
        <span className="text-2xs bg-flux-teal/10 text-flux-teal px-2 py-0.5 rounded-full">IA</span>
      </div>

      <p className="text-xs text-flux-text3 mb-3 leading-relaxed">
        Escribí o pegá las notas de la reunión y Gemini completará el diagnóstico automáticamente.
      </p>

      <textarea
        rows={6}
        value={notas}
        onChange={e => setNotas(e.target.value)}
        placeholder="Ej: El cliente se llama Juan, tiene una empresa de retail con 15 empleados. Usan WhatsApp para todo, no tienen sistema de gestión. El mayor problema es que pierden ventas por falta de seguimiento. Tienen un presupuesto de unos $500 USD mensuales para tecnología..."
        className="flux-input resize-none text-sm mb-3 font-mono text-xs leading-relaxed"
      />

      <div className="flex gap-2">
        <button
          onClick={handleAnalyze}
          disabled={analyzing || !notas.trim()}
          className="btn-primary flex items-center gap-2 text-xs py-2"
        >
          {analyzing ? <><Spinner size={12} /> Analizando…</> : <><Wand2 size={12} /> Analizar con Gemini</>}
        </button>
        {result && (
          <button onClick={handleApply} className="btn-ghost flex items-center gap-2 text-xs py-2 text-flux-teal border-flux-teal/30">
            <CheckCircle size={12} /> Aplicar al formulario
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-flux-danger">
          <AlertCircle size={12} /> {error}
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-2 border-t border-flux-border pt-4">
          <p className="text-2xs text-flux-text3 uppercase tracking-widest mb-2">Análisis de Gemini</p>
          {result.resumenEjecutivo && (
            <div className="bg-flux-surface border border-flux-border rounded-lg p-3">
              <p className="text-2xs text-flux-teal font-medium mb-1">Resumen ejecutivo</p>
              <p className="text-xs text-flux-text1">{result.resumenEjecutivo}</p>
            </div>
          )}
          {result.tipoCliente && (
            <div className="flex items-center gap-2">
              <span className="text-2xs text-flux-text3">Recomendación:</span>
              <span className={cn('text-2xs px-2 py-0.5 rounded-full font-medium',
                result.tipoCliente === 'abono' ? 'bg-flux-tealGlow text-flux-teal' :
                result.tipoCliente === 'proyecto' ? 'bg-blue-950 text-blue-400' :
                'bg-flux-muted text-flux-text3')}>
                {result.tipoCliente === 'abono' ? 'Abono mensual' :
                 result.tipoCliente === 'proyecto' ? 'Proyecto puntual' : 'No califica'}
              </span>
              {result.prioridad && (
                <span className={cn('text-2xs px-2 py-0.5 rounded-full font-medium',
                  result.prioridad === 'alta' ? 'bg-red-950 text-red-400' :
                  result.prioridad === 'media' ? 'bg-amber-950 text-amber-400' :
                  'bg-flux-muted text-flux-text3')}>
                  Prioridad {result.prioridad}
                </span>
              )}
            </div>
          )}
          {result.proximaAccion && (
            <div className="bg-flux-surface border border-flux-border rounded-lg p-3">
              <p className="text-2xs text-flux-warning font-medium mb-1">Próxima acción</p>
              <p className="text-xs text-flux-text1">{result.proximaAccion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Question field ────────────────────────────────────────
function Q({ num, pregunta, porque, value, onChange }: {
  num: number; pregunta: string; porque: string
  value?: string; onChange: (v: string) => void
}) {
  return (
    <div className="border border-flux-border rounded-xl overflow-hidden">
      <div className="bg-flux-surface px-4 py-3 border-b border-flux-border">
        <div className="flex gap-3">
          <span className="text-xs font-bold text-flux-teal w-6 shrink-0">{num}</span>
          <div>
            <p className="text-sm font-medium text-flux-text1">{pregunta}</p>
            <p className="text-2xs text-flux-text3 mt-0.5">
              <span className="text-flux-warning">Por qué:</span> {porque}
            </p>
          </div>
        </div>
      </div>
      <textarea rows={2} value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder="Respuesta…"
        className="w-full bg-flux-card px-4 py-3 text-sm text-flux-text1 placeholder-flux-text3 resize-none focus:outline-none focus:ring-1 focus:ring-flux-teal transition-colors" />
    </div>
  )
}

function SectionHeader({ num, title, note }: { num: string; title: string; note?: string }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b-2 border-flux-teal/20 mb-4">
      <span className="text-flux-teal font-display font-bold text-lg">{num}</span>
      <div>
        <h3 className="font-display font-bold text-flux-white">{title}</h3>
        {note && <p className="text-2xs text-flux-text3 mt-0.5">{note}</p>}
      </div>
    </div>
  )
}

function ScoreRow({ label, value, onChange }: {
  label: string; value?: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-4 py-2 border-b border-flux-border/50">
      <span className="text-xs text-flux-text2 flex-1">{label}</span>
      <div className="flex gap-1">
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={cn('w-8 h-8 rounded-lg text-xs font-bold transition-all',
              value === n ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────
function DiagModal({ diag, leads, responsableId, onClose }: {
  diag?: DiagnosticoCompleto; leads: Lead[]
  responsableId: string; onClose: () => void
}) {
  const isEdit = !!diag
  const [saving,      setSaving]      = useState(false)
  const [showGemini,  setShowGemini]  = useState(false)
  const [form, setForm] = useState<Partial<DiagnosticoCompleto>>(diag ?? { estado: 'borrador' })

  function set(key: keyof DiagnosticoCompleto, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function applyGemini(data: Record<string, string>) {
    setForm(prev => ({ ...prev, ...data }))
    setShowGemini(false)
  }

  async function handleSave(estado?: DiagnosticoCompleto['estado']) {
    if (!form.leadId || !form.titulo) {
      alert('Completá el lead y el título antes de guardar.')
      return
    }
    setSaving(true)
    const payload = { ...form, responsableId, estado: estado ?? form.estado ?? 'borrador' }
    try {
      if (isEdit && diag) await updateDocById('diagnosticos', diag.id, payload)
      else await createDoc('diagnosticos', payload)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-flux-border shrink-0">
          <div>
            <h2 className="font-display font-bold text-base text-flux-white">Diagnóstico Tecnológico PyME</h2>
            <p className="text-2xs text-flux-text3">Formulario de relevamiento</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowGemini(s => !s)}
              className={cn('text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-all border',
                showGemini ? 'bg-flux-tealGlow border-flux-teal text-flux-teal' : 'btn-ghost')}>
              <Sparkles size={12} /> Gemini IA
            </button>
            <button onClick={() => handleSave('borrador')} disabled={saving} className="btn-ghost text-xs py-1.5">
              Guardar borrador
            </button>
            <button onClick={() => handleSave('completado')} disabled={saving}
              className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
              {saving && <div className="w-3 h-3 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              Completar
            </button>
            <button onClick={onClose} className="text-flux-text3 hover:text-flux-text1 p-1"><X size={16} /></button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-6 flex gap-6">

          {/* Main form */}
          <div className="flex-1 space-y-8 min-w-0">

            {/* Header fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Título *</label>
                <input className="flux-input" placeholder="Ej: Diagnóstico Tecnológico — Acme S.L."
                  value={form.titulo ?? ''} onChange={e => set('titulo', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Lead *</label>
                <select className="flux-input" value={form.leadId ?? ''} onChange={e => set('leadId', e.target.value)}>
                  <option value="">Selecciona…</option>
                  {leads.filter(l => l.estado !== 'descartado').map(l => (
                    <option key={l.id} value={l.id}>{l.nombre} — {l.empresa}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado</label>
                <select className="flux-input" value={form.estado ?? 'borrador'} onChange={e => set('estado', e.target.value)}>
                  <option value="borrador">Borrador</option>
                  <option value="en_revision">En revisión</option>
                  <option value="completado">Completado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Contacto principal</label>
                <input className="flux-input" placeholder="Nombre y cargo"
                  value={form.contactoPrincipal ?? ''} onChange={e => set('contactoPrincipal', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Fecha</label>
                <input type="date" className="flux-input"
                  value={form.fechaDiagnostico ?? ''} onChange={e => set('fechaDiagnostico', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Consultor</label>
                <input className="flux-input" value={form.consultorACargo ?? ''} onChange={e => set('consultorACargo', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Duración reunión</label>
                <input className="flux-input" placeholder="75 minutos"
                  value={form.duracionReunion ?? ''} onChange={e => set('duracionReunion', e.target.value)} />
              </div>
            </div>

            {/* S01 */}
            <section>
              <SectionHeader num="01" title="Contexto del Negocio" />
              <div className="space-y-3">
                <Q num={1} pregunta="¿A qué se dedica la empresa y cuánto tiempo lleva en el mercado?" porque="Entender el modelo base." value={form.s01_q1} onChange={v => set('s01_q1', v)} />
                <Q num={2} pregunta="¿Cuántas personas trabajan hoy?" porque="El tamaño define qué herramientas son viables." value={form.s01_q2} onChange={v => set('s01_q2', v)} />
                <Q num={3} pregunta="¿Cuáles son los principales productos o servicios?" porque="Identificar líneas de negocio." value={form.s01_q3} onChange={v => set('s01_q3', v)} />
                <Q num={4} pregunta="¿Cómo consiguen sus clientes hoy?" porque="Detectar oportunidades de canal digital." value={form.s01_q4} onChange={v => set('s01_q4', v)} />
                <Q num={5} pregunta="¿Cuál es el mayor desafío del negocio en este momento?" porque="La respuesta espontánea revela el dolor más urgente." value={form.s01_q5} onChange={v => set('s01_q5', v)} />
                <div>
                  <label className="block text-xs font-medium text-flux-text3 mb-1.5">Resumen del contexto</label>
                  <textarea rows={2} className="flux-input resize-none text-sm" value={form.s01_resumen ?? ''} onChange={e => set('s01_resumen', e.target.value)} />
                </div>
              </div>
            </section>

            {/* S02 */}
            <section>
              <SectionHeader num="02" title="Procesos Internos" />
              <div className="space-y-3">
                <Q num={6} pregunta="¿Cómo registran los pedidos o ventas?" porque="Detecta pérdida de información." value={form.s02_q6} onChange={v => set('s02_q6', v)} />
                <Q num={7} pregunta="¿Cómo manejan el stock o inventario?" porque="El inventario manual es foco de pérdida." value={form.s02_q7} onChange={v => set('s02_q7', v)} />
                <Q num={8} pregunta="¿Cómo hacen la facturación y el cobro?" porque="Muchas PyMEs pierden horas en facturación manual." value={form.s02_q8} onChange={v => set('s02_q8', v)} />
                <Q num={9} pregunta="¿Tienen algún proceso que se repite y les consume mucho tiempo?" porque="Abre la puerta a automatizaciones." value={form.s02_q9} onChange={v => set('s02_q9', v)} />
                <Q num={10} pregunta="¿Cómo se comunica el equipo internamente?" porque="Muestra nivel de informalidad operativa." value={form.s02_q10} onChange={v => set('s02_q10', v)} />
                <Q num={11} pregunta="¿Tienen información importante guardada en varios lugares?" porque="Revela fragmentación de la información." value={form.s02_q11} onChange={v => set('s02_q11', v)} />
              </div>
            </section>

            {/* S03 */}
            <section>
              <SectionHeader num="03" title="Tecnología Actual" />
              <div className="space-y-3">
                <Q num={12} pregunta="¿Qué herramientas tecnológicas usan hoy?" porque="Mapa base del ecosistema actual." value={form.s03_q12} onChange={v => set('s03_q12', v)} />
                <Q num={13} pregunta="¿Tienen email corporativo?" porque="Quick win fácil y de impacto inmediato." value={form.s03_q13} onChange={v => set('s03_q13', v)} />
                <Q num={14} pregunta="¿Usan algún sistema de gestión (ERP, CRM)?" porque="Oportunidad directa de venta del servicio." value={form.s03_q14} onChange={v => set('s03_q14', v)} />
                <Q num={15} pregunta="¿Tienen presencia online (web, redes, tienda)?" porque="Detecta canal digital ausente." value={form.s03_q15} onChange={v => set('s03_q15', v)} />
                <Q num={16} pregunta="¿Qué tanto usan el celular vs la computadora?" porque="Define si las soluciones deben ser mobile-first." value={form.s03_q16} onChange={v => set('s03_q16', v)} />
                <Q num={17} pregunta="¿Han intentado implementar tecnología antes?" porque="Detecta resistencia al cambio." value={form.s03_q17} onChange={v => set('s03_q17', v)} />
                <div>
                  <label className="block text-xs font-medium text-flux-text3 mb-1.5">Mapa de herramientas</label>
                  <textarea rows={3} className="flux-input resize-none text-sm font-mono" placeholder="Herramienta | Para qué | Nivel de uso"
                    value={form.s03_herramientas ?? ''} onChange={e => set('s03_herramientas', e.target.value)} />
                </div>
              </div>
            </section>

            {/* S04 */}
            <section>
              <SectionHeader num="04" title="Seguridad Informática" />
              <div className="space-y-3">
                <Q num={18} pregunta="¿Las contraseñas las conoce solo el dueño o las comparte con el equipo?" porque="Riesgo más común y fácil de corregir." value={form.s04_q18} onChange={v => set('s04_q18', v)} />
                <Q num={19} pregunta="¿Tienen backup de la información importante?" porque="Un incidente puede cerrar el negocio." value={form.s04_q19} onChange={v => set('s04_q19', v)} />
                <Q num={20} pregunta="¿Alguna vez sufrieron pérdida de datos o hackeo?" porque="Genera motivación preventiva." value={form.s04_q20} onChange={v => set('s04_q20', v)} />
                <Q num={21} pregunta="¿Quién tiene acceso cuando un empleado se va?" porque="Revela si hay gestión de accesos." value={form.s04_q21} onChange={v => set('s04_q21', v)} />
                <div>
                  <label className="block text-xs font-medium text-flux-text3 mb-2">Nivel de riesgo detectado</label>
                  <div className="flex gap-2">
                    {(['bajo', 'medio', 'alto'] as const).map(r => (
                      <button key={r} type="button" onClick={() => set('s04_nivelRiesgo', r)}
                        className={cn('px-4 py-2 rounded-lg text-xs font-medium transition-all capitalize',
                          form.s04_nivelRiesgo === r
                            ? r === 'alto' ? 'bg-flux-danger text-white' : r === 'medio' ? 'bg-flux-warning text-flux-bg' : 'bg-flux-success text-flux-bg'
                            : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* S05 */}
            <section>
              <SectionHeader num="05" title="Números del Negocio" />
              <div className="space-y-3">
                <Q num={22} pregunta="¿Tienen claridad de cuánto les cuesta cada producto?" porque="Sin margen no pueden tomar decisiones." value={form.s05_q22} onChange={v => set('s05_q22', v)} />
                <Q num={23} pregunta="¿Saben cuáles son los productos que más facturan?" porque="El análisis 80/20 puede cambiar la estrategia." value={form.s05_q23} onChange={v => set('s05_q23', v)} />
                <Q num={24} pregunta="¿Tienen costos fijos que sienten que son altos?" porque="Conecta con el dolor principal del segmento PyME." value={form.s05_q24} onChange={v => set('s05_q24', v)} />
                <Q num={25} pregunta="¿Tienen objetivo de facturación para este año?" porque="Permite alinear soluciones con metas." value={form.s05_q25} onChange={v => set('s05_q25', v)} />
                <Q num={26} pregunta="¿Cuánto invierten hoy en tecnología por mes?" porque="Referencia de presupuesto disponible." value={form.s05_q26} onChange={v => set('s05_q26', v)} />
              </div>
            </section>

            {/* S06 */}
            <section>
              <SectionHeader num="06" title="Cierre y Expectativas" />
              <div className="space-y-3">
                <Q num={27} pregunta="Si pudieras mejorar una sola cosa en 3 meses, ¿qué sería?" porque="Revela la prioridad real del dueño." value={form.s06_q27} onChange={v => set('s06_q27', v)} />
                <Q num={28} pregunta="¿Hay algo que hoy les impide crecer en ventas?" porque="Identifica el cuello de botella principal." value={form.s06_q28} onChange={v => set('s06_q28', v)} />
                <Q num={29} pregunta="¿Tienen alguien en el equipo que se ocupe de tecnología?" porque="Define si necesitan capacitación." value={form.s06_q29} onChange={v => set('s06_q29', v)} />
                <Q num={30} pregunta="¿Hay algo que les preocupe de contratar este servicio?" porque="Saca objeciones a la superficie." value={form.s06_q30} onChange={v => set('s06_q30', v)} />
                <div className="flux-card space-y-1">
                  <p className="text-xs font-medium text-flux-text2 mb-3">Disposición al cambio (1-5)</p>
                  <ScoreRow label="Urgencia de mejora" value={form.s06_urgencia} onChange={v => set('s06_urgencia', v)} />
                  <ScoreRow label="Apertura al cambio" value={form.s06_apertura} onChange={v => set('s06_apertura', v)} />
                  <ScoreRow label="Capacidad económica" value={form.s06_capacidad} onChange={v => set('s06_capacidad', v)} />
                  <ScoreRow label="Confianza generada" value={form.s06_confianza} onChange={v => set('s06_confianza', v)} />
                </div>
              </div>
            </section>

            {/* S07 */}
            <section>
              <SectionHeader num="07" title="Conclusiones" />
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Principales hallazgos</label>
                  <textarea rows={4} className="flux-input resize-none text-sm" placeholder="Top 3-5 hallazgos…" value={form.s07_hallazgos ?? ''} onChange={e => set('s07_hallazgos', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Oportunidades detectadas</label>
                  <textarea rows={4} className="flux-input resize-none text-sm font-mono" placeholder="Oportunidad | Impacto | Urgencia" value={form.s07_oportunidades ?? ''} onChange={e => set('s07_oportunidades', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Servicios recomendados</label>
                  <textarea rows={3} className="flux-input resize-none text-sm font-mono" placeholder="Servicio | Modalidad | Prioridad" value={form.s07_serviciosRecomendados ?? ''} onChange={e => set('s07_serviciosRecomendados', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-2">Tipo de cliente recomendado</label>
                  <div className="flex gap-2">
                    {([
                      { key: 'abono', label: 'Abono mensual' },
                      { key: 'proyecto', label: 'Proyecto puntual' },
                      { key: 'no_califica', label: 'No califica' },
                    ] as const).map(({ key, label }) => (
                      <button key={key} type="button" onClick={() => set('s07_tipoCliente', key)}
                        className={cn('flex-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all',
                          form.s07_tipoCliente === key ? 'border-flux-teal bg-flux-tealGlow text-flux-teal' : 'border-flux-border hover:border-flux-muted text-flux-text2')}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Próximos pasos</label>
                  <textarea rows={3} className="flux-input resize-none text-sm font-mono" placeholder="1. Acción | Fecha" value={form.s07_proximosPasos ?? ''} onChange={e => set('s07_proximosPasos', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Notas del consultor</label>
                  <textarea rows={3} className="flux-input resize-none text-sm" placeholder="Observaciones adicionales…" value={form.s07_notas ?? ''} onChange={e => set('s07_notas', e.target.value)} />
                </div>
              </div>
            </section>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-flux-border">
              <button onClick={onClose} className="btn-ghost">Cancelar</button>
              <button onClick={() => handleSave('borrador')} disabled={saving} className="btn-ghost">Borrador</button>
              <button onClick={() => handleSave('completado')} disabled={saving}
                className="btn-primary flex items-center gap-2">
                {saving && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
                Completado
              </button>
            </div>
          </div>

          {/* Gemini panel */}
          {showGemini && (
            <div className="w-80 shrink-0">
              <div className="sticky top-0">
                <GeminiPanel onApply={applyGemini} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export default function DiagnosticosPage() {
  const { profile } = useAuthContext()
  const { data: diags, loading: ld } = useCollection<DiagnosticoCompleto>('diagnosticos')
  const { data: leads, loading: ll } = useCollection<Lead>('leads')

  const [modal,     setModal]     = useState<'new' | DiagnosticoCompleto | null>(null)
  const [menuId,    setMenuId]    = useState<string | null>(null)
  const [filterEst, setFilterEst] = useState<string>('todos')

  const leadMap  = Object.fromEntries(leads.map(l => [l.id, l]))
  const filtered = diags.filter(d => filterEst === 'todos' || d.estado === filterEst)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este diagnóstico?')) return
    await deleteDocById('diagnosticos', id)
    setMenuId(null)
  }

  return (
    <>
      <div className="animate-fade-in">
        <PageHeader
          title="Diagnósticos"
          subtitle={`${diags.length} diagnóstico${diags.length !== 1 ? 's' : ''}`}
          actions={
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Nuevo diagnóstico
            </button>
          }
        />
        <div className="px-8 pb-10 space-y-5">
          <div className="flex gap-1.5 flex-wrap">
            {(['todos', 'borrador', 'en_revision', 'completado'] as const).map(e => (
              <button key={e} onClick={() => setFilterEst(e)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  filterEst === e ? 'bg-flux-teal text-flux-bg' : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                {e === 'todos' ? 'Todos' : ESTADO_LABEL[e]}
              </button>
            ))}
          </div>

          {ld || ll ? (
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center"><Spinner /> Cargando…</div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Stethoscope size={40} />} title="Sin diagnósticos"
              description="Usá la plantilla de diagnóstico con asistencia de Gemini IA."
              action={<button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2"><Plus size={14} /> Nuevo diagnóstico</button>} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(diag => {
                const lead  = leadMap[diag.leadId]
                const filled = [diag.s01_q1, diag.s01_q5, diag.s02_q6, diag.s02_q9, diag.s03_q12, diag.s03_q14, diag.s04_q18, diag.s04_q19, diag.s05_q22, diag.s05_q25, diag.s06_q27, diag.s07_hallazgos].filter(Boolean).length
                const pct   = Math.round((filled / 12) * 100)
                const score = [diag.s06_urgencia, diag.s06_apertura, diag.s06_capacidad, diag.s06_confianza].filter(Boolean)
                const avg   = score.length > 0 ? (score.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0) / score.length : null

                return (
                  <div key={diag.id} className="flux-card group relative">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant={ESTADO_BADGE[diag.estado]}>{ESTADO_LABEL[diag.estado]}</Badge>
                      <div className="relative">
                        <button onClick={() => setMenuId(menuId === diag.id ? null : diag.id)}
                          className="text-flux-text2 hover:text-flux-white p-1 rounded transition-colors">
                          <MoreHorizontal size={14} />
                        </button>
                        {menuId === diag.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuId(null)} />
                            <div className="absolute top-full right-0 mt-1 z-20 bg-flux-card border border-flux-border rounded-xl shadow-card-hover py-1 min-w-[130px]">
                              <button onClick={() => { setModal(diag); setMenuId(null) }}
                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-text2 hover:bg-flux-muted">
                                <Pencil size={11} /> Editar
                              </button>
                              <button onClick={() => handleDelete(diag.id)}
                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs text-flux-danger hover:bg-flux-muted">
                                <Trash2 size={11} /> Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <button className="text-left w-full" onClick={() => setModal(diag)}>
                      <h3 className="font-medium text-flux-text1 group-hover:text-flux-white transition-colors mb-1 text-sm">{diag.titulo}</h3>
                      {lead && (
                        <p className="text-2xs text-flux-text3 mb-3 flex items-center gap-1">
                          <ExternalLink size={10} /> {lead.nombre} — {lead.empresa}
                        </p>
                      )}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-2xs text-flux-text3">Completado</span>
                          <span className="text-2xs font-medium text-flux-text2">{pct}%</span>
                        </div>
                        <div className="w-full h-1 bg-flux-muted rounded-full overflow-hidden">
                          <div className="h-full bg-flux-teal rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {avg !== null && (
                          <span className="text-2xs text-flux-teal">Score: {avg.toFixed(1)}/5</span>
                        )}
                        {diag.s07_tipoCliente && (
                          <span className={cn('text-2xs px-2 py-0.5 rounded-full font-medium',
                            diag.s07_tipoCliente === 'abono' ? 'bg-flux-tealGlow text-flux-teal' :
                            diag.s07_tipoCliente === 'proyecto' ? 'bg-blue-950 text-blue-400' :
                            'bg-flux-muted text-flux-text3')}>
                            {diag.s07_tipoCliente === 'abono' ? 'Abono' : diag.s07_tipoCliente === 'proyecto' ? 'Proyecto' : 'No califica'}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t border-flux-border/50 flex items-center justify-between">
                        <span className="text-2xs text-flux-text3">{format(toDate(diag.creadoEn), "d MMM yyyy", { locale: es })}</span>
                        <span className="text-2xs text-flux-teal opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <FileText size={10} /> Abrir →
                        </span>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {modal !== null && (
        <DiagModal diag={modal === 'new' ? undefined : modal} leads={leads}
          responsableId={profile?.uid ?? ''} onClose={() => setModal(null)} />
      )}
    </>
  )
}
