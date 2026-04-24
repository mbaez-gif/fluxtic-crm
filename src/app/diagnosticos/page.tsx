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
import Link               from 'next/link'
import {
  Plus, Stethoscope, ExternalLink, Pencil, Trash2,
  FileText, MoreHorizontal,
} from 'lucide-react'

// ── Extended Diagnostico type with full template fields ───
interface DiagnosticoCompleto {
  id:            string
  leadId:        string
  titulo:        string
  estado:        'borrador' | 'en_revision' | 'completado'
  responsableId: string
  // Header info
  contactoPrincipal?: string
  fechaDiagnostico?:  string
  consultorACargo?:   string
  duracionReunion?:   string
  // Sección 01
  s01_q1?: string; s01_q2?: string; s01_q3?: string; s01_q4?: string; s01_q5?: string
  s01_resumen?: string
  // Sección 02
  s02_q6?: string; s02_q7?: string; s02_q8?: string; s02_q9?: string; s02_q10?: string; s02_q11?: string
  s02_resumen?: string
  // Sección 03
  s03_q12?: string; s03_q13?: string; s03_q14?: string; s03_q15?: string; s03_q16?: string; s03_q17?: string
  s03_herramientas?: string
  // Sección 04
  s04_q18?: string; s04_q19?: string; s04_q20?: string; s04_q21?: string
  s04_nivelRiesgo?: 'bajo' | 'medio' | 'alto'
  // Sección 05
  s05_q22?: string; s05_q23?: string; s05_q24?: string; s05_q25?: string; s05_q26?: string
  s05_resumen?: string
  // Sección 06
  s06_q27?: string; s06_q28?: string; s06_q29?: string; s06_q30?: string
  s06_urgencia?: number; s06_apertura?: number; s06_capacidad?: number; s06_confianza?: number
  // Sección 07
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
      <textarea
        rows={2}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder="Respuesta…"
        className="w-full bg-flux-card px-4 py-3 text-sm text-flux-text1 placeholder-flux-text3 resize-none focus:outline-none focus:ring-1 focus:ring-flux-teal transition-colors"
      />
    </div>
  )
}

// ── Section header ────────────────────────────────────────
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

// ── Score selector ────────────────────────────────────────
function ScoreRow({ label, value, onChange }: {
  label: string; value?: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-4 py-2 border-b border-flux-border/50">
      <span className="text-xs text-flux-text2 flex-1">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={cn(
              'w-8 h-8 rounded-lg text-xs font-bold transition-all',
              value === n
                ? 'bg-flux-teal text-flux-bg'
                : 'bg-flux-muted text-flux-text3 hover:text-flux-text1'
            )}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Full diagnostic form modal ────────────────────────────
function DiagModal({
  diag, leads, responsableId, onClose,
}: {
  diag?:         DiagnosticoCompleto
  leads:         Lead[]
  responsableId: string
  onClose:       () => void
}) {
  const isEdit = !!diag
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<DiagnosticoCompleto>>(diag ?? {
    estado: 'borrador',
  })

  function set(key: keyof DiagnosticoCompleto, value: unknown) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave(estado?: DiagnosticoCompleto['estado']) {
    if (!form.leadId || !form.titulo) {
      alert('Completá el lead y el título antes de guardar.')
      return
    }
    setSaving(true)
    const payload = { ...form, responsableId, estado: estado ?? form.estado ?? 'borrador' }
    try {
      if (isEdit && diag) {
        await updateDocById('diagnosticos', diag.id, payload)
      } else {
        await createDoc('diagnosticos', payload)
      }
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-flux-card border border-flux-border rounded-2xl shadow-card-hover animate-slide-in max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-flux-border shrink-0">
          <div>
            <h2 className="font-display font-bold text-base text-flux-white">
              Diagnóstico Tecnológico PyME
            </h2>
            <p className="text-2xs text-flux-text3">Formulario de relevamiento • Uso del consultor</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => handleSave('borrador')} disabled={saving}
              className="btn-ghost text-xs py-1.5">
              Guardar borrador
            </button>
            <button onClick={() => handleSave('completado')} disabled={saving}
              className="btn-primary text-xs py-1.5 flex items-center gap-1.5">
              {saving && <div className="w-3 h-3 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              Completar
            </button>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="overflow-y-auto px-6 py-6 space-y-8">

          {/* Datos de cabecera */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Título del diagnóstico *</label>
              <input className="flux-input" placeholder="Ej: Diagnóstico Tecnológico — Acme S.L."
                value={form.titulo ?? ''} onChange={e => set('titulo', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Lead asociado *</label>
              <select className="flux-input" value={form.leadId ?? ''}
                onChange={e => set('leadId', e.target.value)}>
                <option value="">Selecciona un lead…</option>
                {leads.filter(l => l.estado !== 'descartado').map(l => (
                  <option key={l.id} value={l.id}>{l.nombre} — {l.empresa}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Estado</label>
              <select className="flux-input" value={form.estado ?? 'borrador'}
                onChange={e => set('estado', e.target.value)}>
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
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Fecha del diagnóstico</label>
              <input type="date" className="flux-input"
                value={form.fechaDiagnostico ?? ''} onChange={e => set('fechaDiagnostico', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Consultor a cargo</label>
              <input className="flux-input" placeholder="Nombre del consultor"
                value={form.consultorACargo ?? ''} onChange={e => set('consultorACargo', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">Duración de la reunión</label>
              <input className="flux-input" placeholder="Ej: 75 minutos"
                value={form.duracionReunion ?? ''} onChange={e => set('duracionReunion', e.target.value)} />
            </div>
          </div>

          {/* 01 — Contexto del Negocio */}
          <section>
            <SectionHeader num="01" title="Contexto del Negocio" />
            <div className="space-y-3">
              <Q num={1} pregunta="¿A qué se dedica la empresa y cuánto tiempo lleva en el mercado?"
                porque="Entender el modelo base antes de cualquier recomendación."
                value={form.s01_q1} onChange={v => set('s01_q1', v)} />
              <Q num={2} pregunta="¿Cuántas personas trabajan hoy? ¿Cómo está organizado el equipo?"
                porque="El tamaño define qué herramientas son viables."
                value={form.s01_q2} onChange={v => set('s01_q2', v)} />
              <Q num={3} pregunta="¿Cuáles son los principales productos o servicios que ofrecen?"
                porque="Identificar líneas de negocio donde el impacto es mayor."
                value={form.s01_q3} onChange={v => set('s01_q3', v)} />
              <Q num={4} pregunta="¿Cómo consiguen sus clientes hoy? ¿Por qué canal llega la mayoría de las ventas?"
                porque="Detectar oportunidades de canal digital no aprovechadas."
                value={form.s01_q4} onChange={v => set('s01_q4', v)} />
              <Q num={5} pregunta="¿Cuál es el mayor desafío del negocio en este momento?"
                porque="La respuesta espontánea revela el dolor más urgente y real."
                value={form.s01_q5} onChange={v => set('s01_q5', v)} />
              <div>
                <label className="block text-xs font-medium text-flux-text3 mb-1.5">Resumen del contexto</label>
                <textarea rows={3} className="flux-input resize-none text-sm"
                  placeholder="Puntos clave del contexto detectados durante la conversación…"
                  value={form.s01_resumen ?? ''} onChange={e => set('s01_resumen', e.target.value)} />
              </div>
            </div>
          </section>

          {/* 02 — Procesos Internos */}
          <section>
            <SectionHeader num="02" title="Procesos Internos" />
            <div className="space-y-3">
              <Q num={6} pregunta="¿Cómo registran los pedidos o ventas? ¿Usan algún sistema o lo hacen a mano/WhatsApp?"
                porque="Detecta pérdida de información y posibilidad de automatizar el flujo de ventas."
                value={form.s02_q6} onChange={v => set('s02_q6', v)} />
              <Q num={7} pregunta="¿Cómo manejan el stock o inventario?"
                porque="El inventario manual o en Excel es un foco de pérdida frecuente en PyMEs."
                value={form.s02_q7} onChange={v => set('s02_q7', v)} />
              <Q num={8} pregunta="¿Cómo hacen la facturación y el cobro? ¿Cuánto tiempo les lleva al mes?"
                porque="Muchas PyMEs pierden horas en facturación manual que puede automatizarse."
                value={form.s02_q8} onChange={v => set('s02_q8', v)} />
              <Q num={9} pregunta="¿Tienen algún proceso que se repite todos los días o semanas y les consume mucho tiempo?"
                porque="Abre la puerta a automatizaciones concretas y visibles."
                value={form.s02_q9} onChange={v => set('s02_q9', v)} />
              <Q num={10} pregunta="¿Cómo se comunica el equipo internamente?"
                porque="Muestra nivel de informalidad operativa y oportunidad de herramientas colaborativas."
                value={form.s02_q10} onChange={v => set('s02_q10', v)} />
              <Q num={11} pregunta="¿Tienen documentos o información importante guardada en varios lugares distintos?"
                porque="Revela fragmentación de la información y necesidad de centralizar."
                value={form.s02_q11} onChange={v => set('s02_q11', v)} />
              <div>
                <label className="block text-xs font-medium text-flux-text3 mb-1.5">Procesos con mayor oportunidad de mejora</label>
                <textarea rows={2} className="flux-input resize-none text-sm"
                  placeholder="Ej: facturación manual, seguimiento de pedidos por WhatsApp, stock en planilla sin control…"
                  value={form.s02_resumen ?? ''} onChange={e => set('s02_resumen', e.target.value)} />
              </div>
            </div>
          </section>

          {/* 03 — Tecnología Actual */}
          <section>
            <SectionHeader num="03" title="Tecnología Actual" />
            <div className="space-y-3">
              <Q num={12} pregunta="¿Qué herramientas tecnológicas usan hoy (programas, apps, sistemas)?"
                porque="Mapa base del ecosistema actual. Identificar duplicidades y brechas."
                value={form.s03_q12} onChange={v => set('s03_q12', v)} />
              <Q num={13} pregunta="¿Tienen email corporativo o usan cuentas personales?"
                porque="El email corporativo es un quick win fácil y genera profesionalismo inmediato."
                value={form.s03_q13} onChange={v => set('s03_q13', v)} />
              <Q num={14} pregunta="¿Usan algún sistema de gestión (ERP, CRM, punto de venta)?"
                porque="Si no tienen CRM, es una oportunidad directa de venta del servicio."
                value={form.s03_q14} onChange={v => set('s03_q14', v)} />
              <Q num={15} pregunta="¿Tienen presencia online? ¿Web, redes sociales, tienda online?"
                porque="Detecta si hay canal digital ausente que genera pérdida de ventas potenciales."
                value={form.s03_q15} onChange={v => set('s03_q15', v)} />
              <Q num={16} pregunta="¿Qué tanto usan el celular vs la computadora para trabajar?"
                porque="Define si las soluciones deben ser mobile-first para que el equipo las adopte."
                value={form.s03_q16} onChange={v => set('s03_q16', v)} />
              <Q num={17} pregunta="¿Han intentado implementar alguna herramienta tecnológica antes? ¿Cómo les fue?"
                porque="Detecta resistencia al cambio o experiencias negativas previas a neutralizar."
                value={form.s03_q17} onChange={v => set('s03_q17', v)} />
              <div>
                <label className="block text-xs font-medium text-flux-text3 mb-1.5">Mapa de herramientas actuales</label>
                <textarea rows={4} className="flux-input resize-none text-sm font-mono"
                  placeholder="Herramienta | Para qué la usan | Nivel de uso (Alto/Medio/Bajo) | Observación"
                  value={form.s03_herramientas ?? ''} onChange={e => set('s03_herramientas', e.target.value)} />
              </div>
            </div>
          </section>

          {/* 04 — Seguridad */}
          <section>
            <SectionHeader num="04" title="Seguridad Informática"
              note="Hacer este bloque con calma. No para asustar, sino para generar conciencia." />
            <div className="space-y-3">
              <Q num={18} pregunta="¿Las contraseñas de los sistemas las conoce solo el dueño o las comparte con el equipo?"
                porque="Las contraseñas compartidas son el riesgo más común y fácil de corregir."
                value={form.s04_q18} onChange={v => set('s04_q18', v)} />
              <Q num={19} pregunta="¿Tienen backup de la información importante del negocio? ¿Dónde se guarda?"
                porque="La mayoría no tiene backups. Un incidente puede cerrar el negocio."
                value={form.s04_q19} onChange={v => set('s04_q19', v)} />
              <Q num={20} pregunta="¿Alguna vez sufrieron pérdida de datos, hackeo o acceso no autorizado?"
                porque="La experiencia previa genera motivación. Si no ocurrió, es oportunidad de prevención."
                value={form.s04_q20} onChange={v => set('s04_q20', v)} />
              <Q num={21} pregunta="¿Quién tiene acceso a los sistemas cuando un empleado se va de la empresa?"
                porque="Revela si hay gestión de accesos o si ex-empleados pueden seguir entrando."
                value={form.s04_q21} onChange={v => set('s04_q21', v)} />
              <div>
                <label className="block text-xs font-medium text-flux-text3 mb-2">Nivel de riesgo detectado</label>
                <div className="flex gap-2">
                  {(['bajo', 'medio', 'alto'] as const).map(r => (
                    <button key={r} type="button" onClick={() => set('s04_nivelRiesgo', r)}
                      className={cn('px-4 py-2 rounded-lg text-xs font-medium transition-all capitalize',
                        form.s04_nivelRiesgo === r
                          ? r === 'alto' ? 'bg-flux-danger text-white'
                            : r === 'medio' ? 'bg-flux-warning text-flux-bg'
                            : 'bg-flux-success text-flux-bg'
                          : 'bg-flux-muted text-flux-text3 hover:text-flux-text1')}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 05 — Números */}
          <section>
            <SectionHeader num="05" title="Números del Negocio"
              note="No pedir estados contables. Solo entender el contexto económico para dimensionar la propuesta." />
            <div className="space-y-3">
              <Q num={22} pregunta="¿Tienen claridad de cuánto les cuesta cada producto o servicio que venden?"
                porque="Si no conocen su margen real, no pueden tomar decisiones. Necesidad de reporte urgente."
                value={form.s05_q22} onChange={v => set('s05_q22', v)} />
              <Q num={23} pregunta="¿Saben cuáles son los productos o clientes que más facturan?"
                porque="El análisis 80/20 puede cambiar la estrategia comercial de inmediato."
                value={form.s05_q23} onChange={v => set('s05_q23', v)} />
              <Q num={24} pregunta="¿Tienen costos fijos que sienten que son altos para el volumen actual de ventas?"
                porque="Conecta directamente con el dolor principal del segmento PyME."
                value={form.s05_q24} onChange={v => set('s05_q24', v)} />
              <Q num={25} pregunta="¿Tienen algún objetivo de facturación o crecimiento para este año?"
                porque="Permite alinear las soluciones con metas concretas de negocio."
                value={form.s05_q25} onChange={v => set('s05_q25', v)} />
              <Q num={26} pregunta="¿Tienen noción de cuánto invierten hoy en tecnología por mes?"
                porque="Referencia de presupuesto disponible y si ya pagan por herramientas que no usan bien."
                value={form.s05_q26} onChange={v => set('s05_q26', v)} />
              <div>
                <label className="block text-xs font-medium text-flux-text3 mb-1.5">Situación económica general</label>
                <textarea rows={3} className="flux-input resize-none text-sm"
                  placeholder="Contexto general: margen percibido, costos que preocupan, objetivos de crecimiento, presupuesto estimado para tecnología…"
                  value={form.s05_resumen ?? ''} onChange={e => set('s05_resumen', e.target.value)} />
              </div>
            </div>
          </section>

          {/* 06 — Cierre */}
          <section>
            <SectionHeader num="06" title="Cierre y Expectativas" />
            <div className="space-y-3">
              <Q num={27} pregunta="Si pudieras mejorar una sola cosa del negocio en los próximos 3 meses, ¿qué sería?"
                porque="La respuesta revela la prioridad real del dueño. Es el punto de partida de la propuesta."
                value={form.s06_q27} onChange={v => set('s06_q27', v)} />
              <Q num={28} pregunta="¿Hay algo que hoy les impide crecer en ventas o atender más clientes?"
                porque="Identifica el cuello de botella principal que hay que atacar primero."
                value={form.s06_q28} onChange={v => set('s06_q28', v)} />
              <Q num={29} pregunta="¿Tienen alguien en el equipo que se ocupe de la parte tecnológica?"
                porque="Define si necesitan capacitación y quién es el interlocutor principal."
                value={form.s06_q29} onChange={v => set('s06_q29', v)} />
              <Q num={30} pregunta="¿Hay algo que les preocupe de contratar un servicio de este tipo?"
                porque="Saca objeciones a la superficie antes de la propuesta. Mucho más fácil trabajarlas aquí."
                value={form.s06_q30} onChange={v => set('s06_q30', v)} />
              <div className="flux-card space-y-1">
                <p className="text-xs font-medium text-flux-text2 mb-3">Disposición al cambio (1 = Muy bajo · 5 = Muy alto)</p>
                <ScoreRow label="Urgencia de mejora percibida"
                  value={form.s06_urgencia} onChange={v => set('s06_urgencia', v)} />
                <ScoreRow label="Apertura al cambio tecnológico"
                  value={form.s06_apertura} onChange={v => set('s06_apertura', v)} />
                <ScoreRow label="Capacidad económica estimada"
                  value={form.s06_capacidad} onChange={v => set('s06_capacidad', v)} />
                <ScoreRow label="Confianza generada en la reunión"
                  value={form.s06_confianza} onChange={v => set('s06_confianza', v)} />
              </div>
            </div>
          </section>

          {/* 07 — Conclusiones */}
          <section>
            <SectionHeader num="07" title="Conclusiones y Recomendaciones" />
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Principales hallazgos</label>
                <textarea rows={4} className="flux-input resize-none text-sm"
                  placeholder="Resumir los 3–5 hallazgos más importantes detectados durante el diagnóstico…"
                  value={form.s07_hallazgos ?? ''} onChange={e => set('s07_hallazgos', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Oportunidades detectadas</label>
                <textarea rows={4} className="flux-input resize-none text-sm font-mono"
                  placeholder="Oportunidad | Impacto (Alto/Medio/Bajo) | Urgencia (Inmediata/3 meses/6 meses)"
                  value={form.s07_oportunidades ?? ''} onChange={e => set('s07_oportunidades', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Servicios recomendados</label>
                <textarea rows={3} className="flux-input resize-none text-sm font-mono"
                  placeholder="Servicio | Modalidad (Abono/Proyecto) | Prioridad (Alta/Media/Baja)"
                  value={form.s07_serviciosRecomendados ?? ''} onChange={e => set('s07_serviciosRecomendados', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-2">Tipo de cliente recomendado</label>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { key: 'abono', label: 'Abono mensual', desc: 'Acompañamiento continuo' },
                    { key: 'proyecto', label: 'Proyecto puntual', desc: 'Implementación específica' },
                    { key: 'no_califica', label: 'No califica por ahora', desc: 'Reagendar en 3–6 meses' },
                  ] as const).map(({ key, label, desc }) => (
                    <button key={key} type="button" onClick={() => set('s07_tipoCliente', key)}
                      className={cn('flex-1 px-3 py-2.5 rounded-xl border text-left transition-all',
                        form.s07_tipoCliente === key
                          ? 'border-flux-teal bg-flux-tealGlow'
                          : 'border-flux-border hover:border-flux-muted')}>
                      <p className={cn('text-xs font-medium', form.s07_tipoCliente === key ? 'text-flux-teal' : 'text-flux-text1')}>
                        {label}
                      </p>
                      <p className="text-2xs text-flux-text3 mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Próximos pasos</label>
                <textarea rows={3} className="flux-input resize-none text-sm font-mono"
                  placeholder="1. Acción | DD/MM/AAAA&#10;2. Acción | DD/MM/AAAA&#10;3. Acción | DD/MM/AAAA"
                  value={form.s07_proximosPasos ?? ''} onChange={e => set('s07_proximosPasos', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">Notas adicionales del consultor</label>
                <textarea rows={3} className="flux-input resize-none text-sm"
                  placeholder="Observaciones, sensaciones de la reunión, aspectos a tener en cuenta para la propuesta…"
                  value={form.s07_notas ?? ''} onChange={e => set('s07_notas', e.target.value)} />
              </div>
            </div>
          </section>

          {/* Save footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-flux-border">
            <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
            <button type="button" onClick={() => handleSave('borrador')} disabled={saving} className="btn-ghost">
              Guardar borrador
            </button>
            <button type="button" onClick={() => handleSave('completado')} disabled={saving}
              className="btn-primary flex items-center gap-2">
              {saving && <div className="w-3.5 h-3.5 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" />}
              Marcar completado
            </button>
          </div>
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

  const leadMap = Object.fromEntries(leads.map(l => [l.id, l]))
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
          subtitle={`${diags.length} diagnóstico${diags.length !== 1 ? 's' : ''} registrados`}
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
            <div className="flex items-center gap-2 text-flux-text3 text-sm py-12 justify-center">
              <Spinner /> Cargando…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Stethoscope size={40} />}
              title="Sin diagnósticos"
              description="Usá la plantilla de diagnóstico tecnológico para evaluar a tus clientes PyME."
              action={
                <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
                  <Plus size={14} /> Nuevo diagnóstico
                </button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(diag => {
                const lead = leadMap[diag.leadId]
                const score = [diag.s06_urgencia, diag.s06_apertura, diag.s06_capacidad, diag.s06_confianza]
                  .filter(Boolean)
                const avgScore = score.length > 0
                  ? (score.reduce((a, b) => (a ?? 0) + (b ?? 0), 0) ?? 0) / score.length
                  : null

                return (
                  <div key={diag.id} className="flux-card group relative">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant={ESTADO_BADGE[diag.estado]}>{ESTADO_LABEL[diag.estado]}</Badge>
                      <div className="relative">
                        <button
                          onClick={() => setMenuId(menuId === diag.id ? null : diag.id)}
                          className="text-flux-text2 hover:text-flux-white transition-colors p-1 rounded">
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
                      <h3 className="font-medium text-flux-text1 group-hover:text-flux-white transition-colors mb-1 text-sm leading-snug">
                        {diag.titulo}
                      </h3>
                      {lead && (
                        <p className="text-2xs text-flux-text3 mb-3 flex items-center gap-1">
                          <ExternalLink size={10} /> {lead.nombre} — {lead.empresa}
                        </p>
                      )}

                      {/* Progress bar */}
                      {(() => {
                        const filled = [
                          diag.s01_q1, diag.s01_q5,
                          diag.s02_q6, diag.s02_q9,
                          diag.s03_q12, diag.s03_q14,
                          diag.s04_q18, diag.s04_q19,
                          diag.s05_q22, diag.s05_q25,
                          diag.s06_q27, diag.s07_hallazgos,
                        ].filter(Boolean).length
                        const pct = Math.round((filled / 12) * 100)
                        return (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-2xs text-flux-text3">Completado</span>
                              <span className="text-2xs font-medium text-flux-text2">{pct}%</span>
                            </div>
                            <div className="w-full h-1 bg-flux-muted rounded-full overflow-hidden">
                              <div className="h-full bg-flux-teal rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Scores */}
                      {avgScore !== null && (
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xs text-flux-text3">Score promedio:</span>
                          <span className="text-xs font-bold text-flux-teal">{avgScore.toFixed(1)}/5</span>
                        </div>
                      )}

                      {/* Tipo cliente */}
                      {diag.s07_tipoCliente && (
                        <div className="mt-2">
                          <span className={cn('text-2xs px-2 py-0.5 rounded-full font-medium',
                            diag.s07_tipoCliente === 'abono' ? 'bg-flux-tealGlow text-flux-teal' :
                            diag.s07_tipoCliente === 'proyecto' ? 'bg-blue-950 text-blue-400' :
                            'bg-flux-muted text-flux-text3')}>
                            {diag.s07_tipoCliente === 'abono' ? 'Abono mensual' :
                             diag.s07_tipoCliente === 'proyecto' ? 'Proyecto puntual' : 'No califica'}
                          </span>
                        </div>
                      )}

                      <div className="mt-3 pt-3 border-t border-flux-border/50 flex items-center justify-between">
                        <span className="text-2xs text-flux-text3">
                          {format(toDate(diag.creadoEn), "d MMM yyyy", { locale: es })}
                        </span>
                        <span className="text-2xs text-flux-teal opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                          <FileText size={10} /> Completar →
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
        <DiagModal
          diag={modal === 'new' ? undefined : modal}
          leads={leads}
          responsableId={profile?.uid ?? ''}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
