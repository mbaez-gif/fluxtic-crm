'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCrearPaciente, useActualizarPaciente } from '@/hooks/useApi'

interface Props {
  paciente?: any  // si viene, modo edición
  onSuccess?: (paciente: any) => void
}

export default function PacienteForm({ paciente, onSuccess }: Props) {
  const router = useRouter()
  const crear = useCrearPaciente()
  const actualizar = useActualizarPaciente()
  const esEdit = !!paciente?.id

  const [form, setForm] = useState({
    dni: paciente?.dni ?? '',
    nombre: paciente?.nombre ?? '',
    apellido: paciente?.apellido ?? '',
    fecha_nacimiento: paciente?.fecha_nacimiento ? new Date(paciente.fecha_nacimiento).toISOString().slice(0, 10) : '',
    sexo: paciente?.sexo ?? 'SIN_DATO',
    telefono: paciente?.telefono ?? '',
    email: paciente?.email ?? '',
    direccion: paciente?.direccion ?? '',
    ciudad: paciente?.ciudad ?? '',
    provincia: paciente?.provincia ?? '',
    ocupacion: paciente?.ocupacion ?? '',
    observaciones: paciente?.observaciones ?? '',
    estado: paciente?.estado ?? 'ACTIVO',
    segmento: paciente?.segmento ?? 'GENERAL',
    canal_origen: paciente?.canal_origen ?? 'RECEPCION',
    referido_por: paciente?.referido_por ?? '',
    campania_origen: paciente?.campania_origen ?? '',
  })
  const [err, setErr] = useState('')

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm((f) => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    const body: any = {
      ...form,
      fecha_nacimiento: form.fecha_nacimiento ? new Date(form.fecha_nacimiento).toISOString() : null,
      telefono: form.telefono || null,
      email: form.email || null,
      direccion: form.direccion || null,
      ciudad: form.ciudad || null,
      provincia: form.provincia || null,
      ocupacion: form.ocupacion || null,
      observaciones: form.observaciones || null,
      referido_por: form.referido_por || null,
      campania_origen: form.campania_origen || null,
    }
    try {
      const res = esEdit
        ? await actualizar.mutateAsync({ id: paciente!.id, body })
        : await crear.mutateAsync(body) as any
      if (onSuccess) onSuccess(res)
      else router.push(`/admin/pacientes/${(res as any)?.id ?? paciente?.id}`)
    } catch (e: any) {
      setErr(e?.message ?? 'Error al guardar')
    }
  }

  const cargando = crear.isPending || actualizar.isPending

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 880 }}>
      {err && (
        <div style={{ padding: 12, background: 'var(--danger-l)', color: 'var(--danger)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
          {err}
        </div>
      )}

      <Section titulo="Datos personales">
        <Grid>
          <Field label="DNI *" required>
            <input value={form.dni} onChange={(e) => set('dni', e.target.value)} required disabled={esEdit} style={input} />
          </Field>
          <Field label="Fecha de nacimiento">
            <input type="date" value={form.fecha_nacimiento} onChange={(e) => set('fecha_nacimiento', e.target.value)} style={input} />
          </Field>
          <Field label="Sexo">
            <select value={form.sexo} onChange={(e) => set('sexo', e.target.value)} style={input}>
              <option value="SIN_DATO">Sin dato</option>
              <option value="FEMENINO">Femenino</option>
              <option value="MASCULINO">Masculino</option>
              <option value="OTRO">Otro</option>
            </select>
          </Field>
          <Field label="Nombre *" required>
            <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required style={input} />
          </Field>
          <Field label="Apellido *" required>
            <input value={form.apellido} onChange={(e) => set('apellido', e.target.value)} required style={input} />
          </Field>
          <Field label="Ocupación">
            <input value={form.ocupacion} onChange={(e) => set('ocupacion', e.target.value)} style={input} />
          </Field>
        </Grid>
      </Section>

      <Section titulo="Contacto">
        <Grid>
          <Field label="Teléfono">
            <input value={form.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="+54 9 11 ..." style={input} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} style={input} />
          </Field>
          <Field label="Dirección" full>
            <input value={form.direccion} onChange={(e) => set('direccion', e.target.value)} style={input} />
          </Field>
          <Field label="Ciudad">
            <input value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)} style={input} />
          </Field>
          <Field label="Provincia">
            <input value={form.provincia} onChange={(e) => set('provincia', e.target.value)} style={input} />
          </Field>
        </Grid>
      </Section>

      <Section titulo="CRM: segmentación y origen">
        <Grid>
          <Field label="Estado">
            <select value={form.estado} onChange={(e) => set('estado', e.target.value)} style={input}>
              <option value="ACTIVO">Activo</option>
              <option value="INACTIVO">Inactivo</option>
              <option value="EN_SEGUIMIENTO">En seguimiento</option>
              <option value="BLOQUEADO">Bloqueado</option>
            </select>
          </Field>
          <Field label="Segmento">
            <select value={form.segmento} onChange={(e) => set('segmento', e.target.value)} style={input}>
              <option value="GENERAL">General</option>
              <option value="VIP">VIP</option>
              <option value="CRONICO">Crónico</option>
              <option value="SEGUIMIENTO">En seguimiento</option>
              <option value="PARTICULAR">Particular</option>
              <option value="COBERTURA">Con cobertura</option>
            </select>
          </Field>
          <Field label="Canal de origen">
            <select value={form.canal_origen} onChange={(e) => set('canal_origen', e.target.value)} style={input}>
              <option value="RECEPCION">Recepción</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="WEB">Web</option>
              <option value="INSTAGRAM">Instagram</option>
              <option value="REFERIDO">Referido</option>
              <option value="CAMPANIA">Campaña</option>
              <option value="PORTAL_PACIENTE">Portal paciente</option>
              <option value="OTRO">Otro</option>
            </select>
          </Field>
          <Field label="Referido por (si aplica)">
            <input value={form.referido_por} onChange={(e) => set('referido_por', e.target.value)} placeholder="Nombre del referente" style={input} />
          </Field>
          <Field label="Campaña de origen (si aplica)" full>
            <input value={form.campania_origen} onChange={(e) => set('campania_origen', e.target.value)} placeholder="Ej. campaña controles 2026" style={input} />
          </Field>
        </Grid>
      </Section>

      <Section titulo="Observaciones administrativas">
        <Field label="Notas internas" full>
          <textarea value={form.observaciones} onChange={(e) => set('observaciones', e.target.value)} rows={3} style={{ ...input, resize: 'vertical' }} />
        </Field>
      </Section>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <button type="button" onClick={() => router.back()} style={btnSecondary}>Cancelar</button>
        <button type="submit" disabled={cargando} style={btnPrimary}>
          {cargando ? 'Guardando...' : esEdit ? 'Guardar cambios' : 'Crear paciente'}
        </button>
      </div>
    </form>
  )
}

function Section({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--noir)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 14 }}>{titulo}</h3>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>{children}</div>
}

function Field({ label, children, full, required }: { label: string; children: React.ReactNode; full?: boolean; required?: boolean }) {
  return (
    <div style={{ gridColumn: full ? 'span 3' : 'auto' }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: required ? 'var(--noir)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)' }
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
