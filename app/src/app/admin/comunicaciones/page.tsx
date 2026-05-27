'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useComunicaciones, usePlantillasMensaje, useCrearPlantilla, useActualizarPlantilla } from '@/hooks/useApi'

type Tab = 'historial' | 'plantillas'

export default function ComunicacionesPage() {
  const [tab, setTab] = useState<Tab>('historial')

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Comunicaciones con pacientes</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Historial de envíos (WhatsApp/email) y plantillas configurables para automatizaciones n8n.
      </p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {([['historial', 'Historial'], ['plantillas', 'Plantillas']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '10px 16px', border: 'none', background: 'transparent',
            fontSize: 13, fontWeight: tab === k ? 600 : 400,
            color: tab === k ? 'var(--teal)' : 'var(--muted)',
            borderBottom: `2px solid ${tab === k ? 'var(--teal)' : 'transparent'}`, cursor: 'pointer', marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'historial' && <TabHistorial />}
      {tab === 'plantillas' && <TabPlantillas />}
    </div>
  )
}

function TabHistorial() {
  const [filtros, setFiltros] = useState({ tipo: '', canal: '', estado: '' })
  const { data, isLoading } = useComunicaciones({
    tipo: filtros.tipo || undefined,
    canal: filtros.canal || undefined,
    estado: filtros.estado || undefined,
  })

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        <select value={filtros.tipo} onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })} style={input}>
          <option value="">Todos los tipos</option>
          <option value="CONFIRMACION_TURNO">Confirmación turno</option>
          <option value="RECORDATORIO_48H">Recordatorio 48h</option>
          <option value="RECORDATORIO_24H">Recordatorio 24h</option>
          <option value="RECORDATORIO_2H">Recordatorio 2h</option>
          <option value="PREPARACION_PREVIA">Preparación previa</option>
          <option value="POSTCONSULTA">Postconsulta</option>
          <option value="REACTIVACION">Reactivación</option>
          <option value="PAGO_PENDIENTE">Pago pendiente</option>
          <option value="CONFIRMACION_PAGO">Confirmación pago</option>
          <option value="CAMPANIA">Campaña</option>
        </select>
        <select value={filtros.canal} onChange={(e) => setFiltros({ ...filtros, canal: e.target.value })} style={input}>
          <option value="">Todos los canales</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="EMAIL">Email</option>
          <option value="SMS">SMS</option>
        </select>
        <select value={filtros.estado} onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })} style={input}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="ENVIADA">Enviada</option>
          <option value="ENTREGADA">Entregada</option>
          <option value="LEIDA">Leída</option>
          <option value="RESPONDIDA">Respondida</option>
          <option value="FALLIDA">Fallida</option>
        </select>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (data?.data ?? []).length === 0 ? <Empty texto="Sin comunicaciones." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Fecha</th>
                <th style={th}>Paciente</th>
                <th style={th}>Tipo</th>
                <th style={th}>Canal</th>
                <th style={th}>Destino</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data ?? []).map((c: any) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{format(new Date(c.created_at), "dd/MM HH:mm")}</td>
                  <td style={td}>{c.paciente?.apellido}, {c.paciente?.nombre}</td>
                  <td style={td}><span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.tipo}</span></td>
                  <td style={td}>{c.canal === 'WHATSAPP' ? '💬 WhatsApp' : c.canal === 'EMAIL' ? '✉ Email' : c.canal}</td>
                  <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 11 }}>{c.destino}</code></td>
                  <td style={td}><EstadoBadge estado={c.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{data?.total ?? 0} comunicaciones</div>
    </div>
  )
}

function TabPlantillas() {
  const { data: plantillas, isLoading } = usePlantillasMensaje()
  const crear = useCrearPlantilla()
  const actualizar = useActualizarPlantilla()
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ codigo: '', canal: 'WHATSAPP', tipo: 'CONFIRMACION_TURNO', asunto: '', cuerpo: '', variables: '', activa: true })

  function abrirNueva() {
    setEditando('nueva')
    setForm({ codigo: '', canal: 'WHATSAPP', tipo: 'CONFIRMACION_TURNO', asunto: '', cuerpo: '', variables: '', activa: true })
  }
  function abrirEditar(p: any) {
    setEditando(p.id)
    const vars = p.variables ? JSON.parse(p.variables).join(', ') : ''
    setForm({ codigo: p.codigo, canal: p.canal, tipo: p.tipo, asunto: p.asunto ?? '', cuerpo: p.cuerpo, variables: vars, activa: p.activa })
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const body: any = {
      ...form,
      asunto: form.asunto || null,
      variables: form.variables ? form.variables.split(',').map((v) => v.trim()).filter(Boolean) : undefined,
    }
    if (editando === 'nueva') await crear.mutateAsync(body)
    else if (editando) await actualizar.mutateAsync({ id: editando, body })
    setEditando(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Las plantillas se usan desde los workflows de n8n. Variables disponibles: {`{{nombre}}, {{fecha}}, {{hora}}, {{profesional}}, {{sede}}, {{monto}}, {{init_point}}`}
        </p>
        <button onClick={abrirNueva} style={btnPrimary}>+ Nueva plantilla</button>
      </div>

      {editando && (
        <form onSubmit={guardar} style={{ background: 'var(--surface)', border: '1px solid var(--teal)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>{editando === 'nueva' ? 'Nueva plantilla' : 'Editar plantilla'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 10 }}>
            <Field label="Código *"><input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required style={input} placeholder="wa_confirmacion_turno" /></Field>
            <Field label="Canal">
              <select value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} style={input}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
              </select>
            </Field>
            <Field label="Tipo">
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} style={input}>
                <option value="CONFIRMACION_TURNO">Confirmación turno</option>
                <option value="RECORDATORIO_48H">Recordatorio 48h</option>
                <option value="RECORDATORIO_24H">Recordatorio 24h</option>
                <option value="RECORDATORIO_2H">Recordatorio 2h</option>
                <option value="PREPARACION_PREVIA">Preparación previa</option>
                <option value="POSTCONSULTA">Postconsulta</option>
                <option value="REACTIVACION">Reactivación</option>
                <option value="PAGO_PENDIENTE">Pago pendiente</option>
                <option value="CONFIRMACION_PAGO">Confirmación pago</option>
                <option value="CAMPANIA">Campaña</option>
              </select>
            </Field>
          </div>
          {form.canal === 'EMAIL' && (
            <Field label="Asunto"><input value={form.asunto} onChange={(e) => setForm({ ...form, asunto: e.target.value })} style={input} /></Field>
          )}
          <Field label="Cuerpo *">
            <textarea value={form.cuerpo} onChange={(e) => setForm({ ...form, cuerpo: e.target.value })} rows={5} required style={{ ...input, resize: 'vertical', fontFamily: 'var(--font-m)' }} />
          </Field>
          <Field label="Variables usadas (separadas por coma)">
            <input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} placeholder="nombre, profesional, fecha, hora" style={input} />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <button type="button" onClick={() => setEditando(null)} style={btnSecondary}>Cancelar</button>
            <button type="submit" style={btnPrimary}>{editando === 'nueva' ? 'Crear' : 'Guardar'}</button>
          </div>
        </form>
      )}

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (plantillas ?? []).length === 0 ? <Empty texto="Sin plantillas." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Código</th>
                <th style={th}>Canal</th>
                <th style={th}>Tipo</th>
                <th style={th}>Cuerpo</th>
                <th style={th}>Activa</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {(plantillas ?? []).map((p: any) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><code style={{ fontFamily: 'var(--font-m)', fontSize: 11 }}>{p.codigo}</code></td>
                  <td style={td}>{p.canal}</td>
                  <td style={td}><span style={{ fontSize: 11, color: 'var(--muted)' }}>{p.tipo}</span></td>
                  <td style={{ ...td, maxWidth: 400 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted)' }}>{p.cuerpo}</div>
                  </td>
                  <td style={td}>{p.activa ? <span style={{ color: 'var(--salud)' }}>✓</span> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={td}><button onClick={() => abrirEditar(p)} style={iconBtn}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    ENVIADA: { bg: 'var(--clinical-l)', fg: 'var(--clinical)' },
    ENTREGADA: { bg: 'var(--info-l)', fg: 'var(--info)' },
    LEIDA: { bg: 'var(--teal-l)', fg: 'var(--teal-d)' },
    RESPONDIDA: { bg: 'var(--salud-l)', fg: 'var(--salud)' },
    PENDIENTE: { bg: 'var(--warning-l)', fg: 'var(--warning)' },
    FALLIDA: { bg: 'var(--danger-l)', fg: 'var(--danger)' },
  }
  const c = colors[estado] ?? { bg: 'var(--bg-2)', fg: 'var(--noir)' }
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>{estado}</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)' }
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }
const btnPrimary: React.CSSProperties = { padding: '8px 14px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--teal)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }
