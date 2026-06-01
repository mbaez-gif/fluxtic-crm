'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useFeriados, useCrearFeriado, useEliminarFeriado, useSedes } from '@/hooks/useApi'
import { usePermisos } from '@/hooks/usePermisos'

type Tab = 'clinica' | 'sedes' | 'agenda' | 'facturacion' | 'feriados' | 'integraciones'

export default function ConfiguracionPage() {
  const permisos = usePermisos()
  const [tab, setTab] = useState<Tab>('clinica')

  // Configuración es admin-only. Sin permiso global ('*') mostramos un
  // estado vacío en lugar del 403 crudo de la API.
  if (!permisos.has('*')) {
    return (
      <div style={{ padding: 48, maxWidth: 540, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
          Sección restringida
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--noir)', marginBottom: 8 }}>Sin acceso a Configuración</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
          Esta sección está reservada para administradores generales.
          Si necesitás modificar datos de la clínica, sedes, reglas de agenda o
          parámetros de facturación, contactá a un administrador.
        </p>
        <Link href="/admin/dashboard" style={{ display: 'inline-block', padding: '10px 18px', background: 'var(--teal)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
          Volver al dashboard
        </Link>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Configuración</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Datos de la clínica, sedes, reglas de agenda, facturación, feriados e integraciones</p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          ['clinica', 'Clínica'],
          ['sedes', 'Sedes y consultorios'],
          ['agenda', 'Reglas de agenda'],
          ['facturacion', 'Facturación'],
          ['feriados', 'Feriados'],
          ['integraciones', 'Integraciones'],
        ] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', border: 'none', background: 'transparent',
            fontSize: 13, fontWeight: tab === k ? 600 : 400,
            color: tab === k ? 'var(--teal)' : 'var(--muted)',
            borderBottom: `2px solid ${tab === k ? 'var(--teal)' : 'transparent'}`, cursor: 'pointer', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'clinica' && <TabClinica />}
      {tab === 'sedes' && <TabSedes />}
      {tab === 'agenda' && <TabAgenda />}
      {tab === 'facturacion' && <TabFacturacion />}
      {tab === 'feriados' && <TabFeriados />}
      {tab === 'integraciones' && <TabIntegraciones />}
    </div>
  )
}

function TabClinica() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['config-clinica'], queryFn: () => api.get<any>('/configuracion/clinica') })
  const actualizar = useMutation({
    mutationFn: (body: any) => api.patch('/configuracion/clinica', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config-clinica'] }),
  })
  const [form, setForm] = useState({
    nombre: '', razon_social: '', cuit: '', telefono: '', email: '', sitio_web: '', logo_url: '',
    color_principal: '#0F766E', color_acento: '#2563EB', zona_horaria: 'America/Argentina/Buenos_Aires', moneda: 'ARS',
  })
  useEffect(() => {
    if (data) setForm({
      nombre: data.nombre ?? '', razon_social: data.razon_social ?? '', cuit: data.cuit ?? '',
      telefono: data.telefono ?? '', email: data.email ?? '', sitio_web: data.sitio_web ?? '',
      logo_url: data.logo_url ?? '', color_principal: data.color_principal ?? '#0F766E',
      color_acento: data.color_acento ?? '#2563EB', zona_horaria: data.zona_horaria ?? 'America/Argentina/Buenos_Aires',
      moneda: data.moneda ?? 'ARS',
    })
  }, [data])
  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    await actualizar.mutateAsync({
      ...form, razon_social: form.razon_social || null, cuit: form.cuit || null,
      telefono: form.telefono || null, email: form.email || null, sitio_web: form.sitio_web || null, logo_url: form.logo_url || null,
    })
  }
  if (isLoading) return <div style={{ padding: 24 }}>Cargando...</div>
  return (
    <form onSubmit={guardar}>
      <Card titulo="Datos de la clínica">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field label="Nombre comercial *"><input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required style={input} /></Field>
          <Field label="CUIT"><input value={form.cuit} onChange={(e) => setForm({ ...form, cuit: e.target.value })} style={input} /></Field>
          <Field label="Razón social"><input value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} style={input} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} /></Field>
          <Field label="Teléfono"><input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} style={input} /></Field>
          <Field label="Sitio web"><input value={form.sitio_web} onChange={(e) => setForm({ ...form, sitio_web: e.target.value })} placeholder="https://..." style={input} /></Field>
        </div>
      </Card>
      <Card titulo="Branding y regional">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <Field label="Color principal"><input type="color" value={form.color_principal} onChange={(e) => setForm({ ...form, color_principal: e.target.value })} style={{ ...input, height: 40, padding: 2 }} /></Field>
          <Field label="Color acento"><input type="color" value={form.color_acento} onChange={(e) => setForm({ ...form, color_acento: e.target.value })} style={{ ...input, height: 40, padding: 2 }} /></Field>
          <Field label="Moneda"><input value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} style={input} /></Field>
          <Field label="Zona horaria"><input value={form.zona_horaria} onChange={(e) => setForm({ ...form, zona_horaria: e.target.value })} style={input} /></Field>
        </div>
        <Field label="Logo URL"><input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." style={input} /></Field>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={actualizar.isPending} style={btnPrimary}>{actualizar.isPending ? 'Guardando...' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}

function TabAgenda() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['config-agenda'], queryFn: () => api.get<any>('/configuracion/agenda') })
  const actualizar = useMutation({
    mutationFn: (body: any) => api.patch('/configuracion/agenda', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config-agenda'] }),
  })
  const [form, setForm] = useState({
    duracion_slot_min: 30, permite_sobreturnos: true, permite_lista_espera: true,
    anticipacion_min_horas: 2, cancelacion_min_horas: 24,
    recordatorio_48h: true, recordatorio_24h: true, recordatorio_2h: false,
    marcar_no_show_min_minutos: 15,
  })
  useEffect(() => {
    if (data) setForm({
      duracion_slot_min: data.duracion_slot_min ?? 30,
      permite_sobreturnos: data.permite_sobreturnos ?? true,
      permite_lista_espera: data.permite_lista_espera ?? true,
      anticipacion_min_horas: data.anticipacion_min_horas ?? 2,
      cancelacion_min_horas: data.cancelacion_min_horas ?? 24,
      recordatorio_48h: data.recordatorio_48h ?? true,
      recordatorio_24h: data.recordatorio_24h ?? true,
      recordatorio_2h: data.recordatorio_2h ?? false,
      marcar_no_show_min_minutos: data.marcar_no_show_min_minutos ?? 15,
    })
  }, [data])
  async function guardar(e: React.FormEvent) { e.preventDefault(); await actualizar.mutateAsync(form) }
  if (isLoading) return <div style={{ padding: 24 }}>Cargando...</div>
  return (
    <form onSubmit={guardar}>
      <Card titulo="Reglas de slots">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <Field label="Duración slot por defecto (min)"><input type="number" min={5} step={5} value={form.duracion_slot_min} onChange={(e) => setForm({ ...form, duracion_slot_min: Number(e.target.value) })} style={input} /></Field>
          <Field label="Anticipación mínima reserva (hs)"><input type="number" min={0} value={form.anticipacion_min_horas} onChange={(e) => setForm({ ...form, anticipacion_min_horas: Number(e.target.value) })} style={input} /></Field>
          <Field label="Cancelación sin penalidad (hs antes)"><input type="number" min={0} value={form.cancelacion_min_horas} onChange={(e) => setForm({ ...form, cancelacion_min_horas: Number(e.target.value) })} style={input} /></Field>
          <Field label="Marca no-show pasados (min)"><input type="number" min={0} value={form.marcar_no_show_min_minutos} onChange={(e) => setForm({ ...form, marcar_no_show_min_minutos: Number(e.target.value) })} style={input} /></Field>
        </div>
      </Card>
      <Card titulo="Flexibilidad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <Check label="Permite sobreturnos" v={form.permite_sobreturnos} onChange={(v) => setForm({ ...form, permite_sobreturnos: v })} />
          <Check label="Permite lista de espera" v={form.permite_lista_espera} onChange={(v) => setForm({ ...form, permite_lista_espera: v })} />
        </div>
      </Card>
      <Card titulo="Recordatorios automáticos (n8n crons)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <Check label="48 horas antes" v={form.recordatorio_48h} onChange={(v) => setForm({ ...form, recordatorio_48h: v })} />
          <Check label="24 horas antes" v={form.recordatorio_24h} onChange={(v) => setForm({ ...form, recordatorio_24h: v })} />
          <Check label="2 horas antes" v={form.recordatorio_2h} onChange={(v) => setForm({ ...form, recordatorio_2h: v })} />
        </div>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={actualizar.isPending} style={btnPrimary}>{actualizar.isPending ? 'Guardando...' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}

function TabFacturacion() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['config-fact'], queryFn: () => api.get<any>('/configuracion/facturacion') })
  const actualizar = useMutation({
    mutationFn: (body: any) => api.patch('/configuracion/facturacion', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config-fact'] }),
  })
  const [form, setForm] = useState({
    requiere_sena: false, monto_sena_default: 0, porcentaje_sena: 0,
    acepta_mercadopago: false, acepta_transferencia: true,
    numerador_recibo: 1, prefijo_recibo: '',
  })
  useEffect(() => {
    if (data) setForm({
      requiere_sena: data.requiere_sena ?? false,
      monto_sena_default: data.monto_sena_default ? Number(data.monto_sena_default) : 0,
      porcentaje_sena: data.porcentaje_sena ? Number(data.porcentaje_sena) : 0,
      acepta_mercadopago: data.acepta_mercadopago ?? false,
      acepta_transferencia: data.acepta_transferencia ?? true,
      numerador_recibo: data.numerador_recibo ?? 1,
      prefijo_recibo: data.prefijo_recibo ?? '',
    })
  }, [data])
  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    await actualizar.mutateAsync({
      ...form,
      monto_sena_default: form.monto_sena_default || null,
      porcentaje_sena: form.porcentaje_sena || null,
      prefijo_recibo: form.prefijo_recibo || null,
    })
  }
  if (isLoading) return <div style={{ padding: 24 }}>Cargando...</div>
  return (
    <form onSubmit={guardar}>
      <Card titulo="Seña previa">
        <Check label="Requiere seña previa para confirmar turno" v={form.requiere_sena} onChange={(v) => setForm({ ...form, requiere_sena: v })} />
        {form.requiere_sena && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
            <Field label="Monto fijo de seña ($)"><input type="number" min={0} value={form.monto_sena_default} onChange={(e) => setForm({ ...form, monto_sena_default: Number(e.target.value) })} style={input} /></Field>
            <Field label="O porcentaje del total (%)"><input type="number" min={0} max={100} value={form.porcentaje_sena} onChange={(e) => setForm({ ...form, porcentaje_sena: Number(e.target.value) })} style={input} /></Field>
          </div>
        )}
      </Card>
      <Card titulo="Medios de pago online">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <Check label="Acepta Mercado Pago" v={form.acepta_mercadopago} onChange={(v) => setForm({ ...form, acepta_mercadopago: v })} />
          <Check label="Acepta transferencia bancaria" v={form.acepta_transferencia} onChange={(v) => setForm({ ...form, acepta_transferencia: v })} />
        </div>
      </Card>
      <Card titulo="Numeración de recibos">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Próximo número"><input type="number" min={1} value={form.numerador_recibo} onChange={(e) => setForm({ ...form, numerador_recibo: Number(e.target.value) })} style={input} /></Field>
          <Field label="Prefijo (opcional)"><input value={form.prefijo_recibo} onChange={(e) => setForm({ ...form, prefijo_recibo: e.target.value })} placeholder="ej. R-2026-" style={input} /></Field>
        </div>
      </Card>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={actualizar.isPending} style={btnPrimary}>{actualizar.isPending ? 'Guardando...' : 'Guardar cambios'}</button>
      </div>
    </form>
  )
}

function TabSedes() {
  const { data: sedes, isLoading } = useSedes()
  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Sedes y consultorios. La gestión completa vive en su sección dedicada.</p>
        <Link href="/admin/sedes" style={{ padding: '8px 14px', background: 'var(--teal)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Administrar sedes →</Link>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (sedes ?? []).length === 0 ? <Empty texto="Sin sedes." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
              <th style={th}>Nombre</th><th style={th}>Dirección</th><th style={th}>Ciudad</th><th style={th}>Activa</th>
            </tr></thead>
            <tbody>
              {(sedes ?? []).map((s: any) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><strong>{s.nombre}</strong></td>
                  <td style={td}>{s.direccion ?? '—'}</td>
                  <td style={td}>{s.ciudad ?? '—'}</td>
                  <td style={td}>{s.activa ? <span style={{ color: 'var(--salud)' }}>✓</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function TabFeriados() {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const { data: feriados, isLoading } = useFeriados(anio)
  const crear = useCrearFeriado()
  const eliminar = useEliminarFeriado()
  const [nuevo, setNuevo] = useState({ fecha: '', nombre: '', cierra_total: true })
  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    await crear.mutateAsync({ fecha: new Date(nuevo.fecha).toISOString(), nombre: nuevo.nombre, cierra_total: nuevo.cierra_total })
    setNuevo({ fecha: '', nombre: '', cierra_total: true })
  }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={{ ...input, maxWidth: 120 }}>
          {[anio - 1, anio, anio + 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Días no laborables</p>
      </div>
      <Card titulo="Agregar feriado">
        <form onSubmit={agregar} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 100px', gap: 10 }}>
          <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} required style={input} />
          <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre del feriado" required style={input} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={nuevo.cierra_total} onChange={(e) => setNuevo({ ...nuevo, cierra_total: e.target.checked })} />
            Cierra clínica
          </label>
          <button type="submit" style={btnPrimary}>Agregar</button>
        </form>
      </Card>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (feriados ?? []).length === 0 ? <Empty texto="Sin feriados para este año." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
              <th style={th}>Fecha</th><th style={th}>Nombre</th><th style={th}>Cierra</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {(feriados ?? []).map((f: any) => (
                <tr key={f.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{format(new Date(f.fecha), "EEEE d MMM yyyy", { locale: es })}</td>
                  <td style={td}><strong>{f.nombre}</strong></td>
                  <td style={td}>{f.cierra_total ? '✓' : 'Parcial'}</td>
                  <td style={td}><button onClick={() => eliminar.mutate(f.id)} style={iconBtn}>quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function TabIntegraciones() {
  const integraciones = [
    { nombre: 'Mercado Pago', estado: 'Activo', desc: 'Cobro de copagos y señas online', vars: 'MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET' },
    { nombre: 'n8n Automatizaciones', estado: 'Activo', desc: 'Workflows: confirmaciones, recordatorios, postconsulta, reactivación', vars: 'N8N_WEBHOOK_BASE_URL, INTERNAL_API_TOKEN' },
    { nombre: 'WhatsApp Cloud (Meta)', estado: 'Configurable', desc: 'Envío de mensajes vía n8n con templates', vars: 'WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN' },
    { nombre: 'Cloudflare Turnstile', estado: 'Configurable', desc: 'Anti-bot del wizard público de turnos', vars: 'TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY' },
    { nombre: 'MinIO (S3)', estado: 'Activo', desc: 'Almacenamiento de documentos clínicos y PDFs', vars: 'S3_ENDPOINT, S3_BUCKET_HC' },
    { nombre: 'Jitsi Meet (Telemedicina)', estado: 'Activo', desc: 'Videoconsultas por defecto. Compatible con Meet/Whereby/Zoom', vars: 'VIDEOCONSULTA_PROVEEDOR, JITSI_DOMAIN' },
    { nombre: 'Vademécum externo', estado: 'Preparado', desc: 'Sincronización futura con Kairos u otro vademécum', vars: '(pendiente integración)' },
    { nombre: 'Firma electrónica externa', estado: 'Preparado', desc: 'Firma con proveedor externo en Receta', vars: '(pendiente integración)' },
  ]
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Servicios externos que extienden el CRM</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {integraciones.map((i, idx) => (
          <div key={idx} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{i.nombre}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{i.desc}</div>
              <code style={{ fontFamily: 'var(--font-m)', fontSize: 10, color: 'var(--muted-2)' }}>{i.vars}</code>
            </div>
            <span style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, height: 22, alignSelf: 'center',
              background: i.estado === 'Activo' ? 'var(--salud-l)' : i.estado === 'Preparado' ? 'var(--info-l)' : 'var(--warning-l)',
              color: i.estado === 'Activo' ? 'var(--salud)' : i.estado === 'Preparado' ? 'var(--info)' : 'var(--warning)',
            }}>{i.estado}</span>
          </div>
        ))}
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
function Check({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
      <input type="checkbox" checked={v} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)' }
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }
