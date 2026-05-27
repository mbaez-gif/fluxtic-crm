'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useFeriados, useCrearFeriado, useEliminarFeriado, useSedes } from '@/hooks/useApi'

type Tab = 'clinica' | 'sedes' | 'agenda' | 'feriados' | 'integraciones'

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('clinica')

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Configuración</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>Datos de la clínica, sedes, agenda, feriados e integraciones</p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16, flexWrap: 'wrap' }}>
        {([
          ['clinica', 'Clínica'],
          ['sedes', 'Sedes y consultorios'],
          ['agenda', 'Reglas de agenda'],
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
      {tab === 'feriados' && <TabFeriados />}
      {tab === 'integraciones' && <TabIntegraciones />}
    </div>
  )
}

function TabClinica() {
  return (
    <Card titulo="Datos de la clínica">
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Datos básicos, branding y configuración de la organización. Estos valores aparecen
        en comprobantes, recetas, link público y comunicaciones.
      </p>
      <div style={{ padding: 16, background: 'var(--info-l)', color: 'var(--info)', borderRadius: 8, fontSize: 13 }}>
        Edición vía API: <code style={{ fontFamily: 'var(--font-m)' }}>PATCH /configuracion/clinica</code>.
        UI de edición visual disponible en el próximo sprint.
      </div>
    </Card>
  )
}

function TabSedes() {
  const { data: sedes, isLoading } = useSedes()
  return (
    <div>
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Lugares físicos donde se atiende. Cada sede puede tener múltiples consultorios.</p>
        <Link href="/admin/sedes" style={{ padding: '8px 14px', background: 'var(--teal)', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
          Administrar sedes →
        </Link>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (sedes ?? []).length === 0 ? <Empty texto="Sin sedes. Agregá la primera." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Nombre</th>
                <th style={th}>Dirección</th>
                <th style={th}>Ciudad</th>
                <th style={th}>Teléfono</th>
                <th style={th}>Activa</th>
              </tr>
            </thead>
            <tbody>
              {(sedes ?? []).map((s: any) => (
                <tr key={s.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><strong>{s.nombre}</strong></td>
                  <td style={td}>{s.direccion ?? '—'}</td>
                  <td style={td}>{s.ciudad ?? '—'}</td>
                  <td style={td}>{s.telefono ?? '—'}</td>
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

function TabAgenda() {
  return (
    <Card titulo="Reglas de agenda">
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Parámetros que rigen la generación y validación de turnos.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Block titulo="Duración por defecto del slot" valor="30 min" />
        <Block titulo="Permite sobreturnos" valor="Sí" />
        <Block titulo="Permite lista de espera" valor="Sí" />
        <Block titulo="Anticipación mínima de reserva" valor="2 hs" />
        <Block titulo="Cancelación sin penalidad" valor="24 hs" />
        <Block titulo="Marca como no-show" valor="15 min" />
      </div>
      <div style={{ marginTop: 16, padding: 12, background: 'var(--info-l)', color: 'var(--info)', borderRadius: 8, fontSize: 12 }}>
        Edición vía API: <code style={{ fontFamily: 'var(--font-m)' }}>PATCH /configuracion/agenda</code>
      </div>
    </Card>
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
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Días no laborables de la clínica</p>
      </div>

      <Card titulo="Agregar feriado">
        <form onSubmit={agregar} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 100px', gap: 10 }}>
          <input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} required style={input} />
          <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder="Nombre (ej. Año Nuevo)" required style={input} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input type="checkbox" checked={nuevo.cierra_total} onChange={(e) => setNuevo({ ...nuevo, cierra_total: e.target.checked })} />
            Cierra clínica
          </label>
          <button type="submit" style={btnPrimary}>Agregar</button>
        </form>
      </Card>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (feriados ?? []).length === 0 ? <Empty texto="Sin feriados cargados para este año." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Fecha</th>
                <th style={th}>Nombre</th>
                <th style={th}>Cierra clínica</th>
                <th style={th}></th>
              </tr>
            </thead>
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
    { nombre: 'n8n Automatizaciones', estado: 'Activo', desc: 'Workflows para confirmaciones, recordatorios, postconsulta, reactivación', vars: 'N8N_WEBHOOK_BASE_URL, INTERNAL_API_TOKEN' },
    { nombre: 'WhatsApp Cloud (Meta)', estado: 'Configurable', desc: 'Envío de mensajes vía n8n con templates', vars: 'WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN' },
    { nombre: 'Cloudflare Turnstile', estado: 'Configurable', desc: 'Anti-bot del wizard público de turnos', vars: 'TURNSTILE_SECRET_KEY, TURNSTILE_SITE_KEY' },
    { nombre: 'MinIO (S3)', estado: 'Activo', desc: 'Almacenamiento de documentos clínicos y PDFs', vars: 'S3_ENDPOINT, S3_BUCKET_HC' },
    { nombre: 'Jitsi Meet (Telemedicina)', estado: 'Activo', desc: 'Videoconsultas (default). Compatible con Meet/Whereby/Zoom.', vars: 'VIDEOCONSULTA_PROVEEDOR, JITSI_DOMAIN' },
    { nombre: 'Vademécum externo', estado: 'Preparado', desc: 'Arquitectura lista para sincronizar con Kairos u otro vademécum', vars: '(pendiente integración)' },
    { nombre: 'Firma electrónica externa', estado: 'Preparado', desc: 'Arquitectura lista para firma con proveedor externo (campos `proveedor_externo`, `external_id` en Receta)', vars: '(pendiente integración)' },
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
function Block({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{valor}</div>
    </div>
  )
}
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)' }
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }
