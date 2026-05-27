'use client'

import { useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  useComprobantes, useCaja, useDeudas, useCrearPago,
  useBuscarPacientes, useCrearComprobante, usePrestaciones,
} from '@/hooks/useApi'

type Tab = 'caja' | 'comprobantes' | 'deudas' | 'nuevo-comprobante'

export default function FacturacionPage() {
  const [tab, setTab] = useState<Tab>('caja')

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Facturación y cobros</h1>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 16 }}>
        Caja diaria, comprobantes emitidos, deudas pendientes y emisión de nuevos comprobantes.
      </p>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {([['caja', 'Caja del día'], ['comprobantes', 'Comprobantes'], ['deudas', 'Deudas'], ['nuevo-comprobante', '+ Nuevo comprobante']] as [Tab, string][]).map(([k, label]) => (
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

      {tab === 'caja' && <TabCaja />}
      {tab === 'comprobantes' && <TabComprobantes />}
      {tab === 'deudas' && <TabDeudas />}
      {tab === 'nuevo-comprobante' && <TabNuevoComprobante onSuccess={() => setTab('comprobantes')} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Caja diaria
// ════════════════════════════════════════════════════════════════

function TabCaja() {
  const hoy = new Date().toISOString().slice(0, 10)
  const [fecha, setFecha] = useState(hoy)
  const desde = new Date(fecha).setHours(0, 0, 0, 0)
  const hasta = new Date(fecha).setHours(23, 59, 59, 999)
  const { data, isLoading } = useCaja(new Date(desde).toISOString(), new Date(hasta).toISOString())

  const totales = data?.totales ?? {}
  const totalDia = Object.values(totales as Record<string, number>).reduce((a, b) => a + b, 0)
  const movimientos = data?.movimientos ?? []

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ ...input, maxWidth: 200 }} />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          {format(new Date(fecha), "EEEE d 'de' MMMM yyyy", { locale: es })}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 20 }}>
        <Kpi label="Total del día" value={`$${totalDia.toLocaleString('es-AR')}`} color="var(--teal)" />
        {Object.entries(totales as Record<string, number>).map(([medio, monto]) => (
          <Kpi key={medio} label={medio} value={`$${monto.toLocaleString('es-AR')}`} />
        ))}
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : movimientos.length === 0 ? <Empty texto="Sin movimientos en este día." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Hora</th>
                <th style={th}>Tipo</th>
                <th style={th}>Concepto</th>
                <th style={th}>Paciente</th>
                <th style={th}>Medio</th>
                <th style={th}>Monto</th>
                <th style={th}>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m: any) => (
                <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>{format(new Date(m.fecha), 'HH:mm')}</td>
                  <td style={td}><span style={{ color: m.tipo === 'INGRESO' ? 'var(--salud)' : 'var(--danger)', fontWeight: 600 }}>{m.tipo}</span></td>
                  <td style={td}>{m.concepto}</td>
                  <td style={td}>{m.pago?.paciente ? `${m.pago.paciente.apellido}, ${m.pago.paciente.nombre}` : '—'}</td>
                  <td style={td}>{m.medio}</td>
                  <td style={td}><strong>${Number(m.monto).toLocaleString('es-AR')}</strong></td>
                  <td style={td}><span style={{ color: 'var(--muted)', fontSize: 11 }}>{m.usuario.apellido}, {m.usuario.nombre}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Comprobantes
// ════════════════════════════════════════════════════════════════

function TabComprobantes() {
  const [estado, setEstado] = useState('')
  const { data: comprobantes, isLoading } = useComprobantes({ estado: estado || undefined })

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...input, maxWidth: 240 }}>
          <option value="">Todos los estados</option>
          <option value="BORRADOR">Borrador</option>
          <option value="EMITIDO">Emitido (pendiente)</option>
          <option value="PAGO_PARCIAL">Pago parcial</option>
          <option value="PAGADO">Pagado</option>
          <option value="ANULADO">Anulado</option>
        </select>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (comprobantes ?? []).length === 0 ? <Empty texto="Sin comprobantes." /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>N°</th>
                <th style={th}>Fecha</th>
                <th style={th}>Tipo</th>
                <th style={th}>Paciente</th>
                <th style={th}>Total</th>
                <th style={th}>Pagado</th>
                <th style={th}>Saldo</th>
                <th style={th}>Estado</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {(comprobantes ?? []).map((c: any) => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><code style={{ fontSize: 11 }}>{c.numero ?? c.id.slice(-8).toUpperCase()}</code></td>
                  <td style={td}>{format(new Date(c.fecha), 'dd/MM/yyyy')}</td>
                  <td style={td}>{c.tipo}</td>
                  <td style={td}>{c.paciente.apellido}, {c.paciente.nombre}</td>
                  <td style={td}>${Number(c.total).toLocaleString('es-AR')}</td>
                  <td style={td}>${Number(c.total_pagado).toLocaleString('es-AR')}</td>
                  <td style={td}><strong style={{ color: Number(c.saldo) > 0 ? 'var(--danger)' : 'var(--salud)' }}>
                    ${Number(c.saldo).toLocaleString('es-AR')}
                  </strong></td>
                  <td style={td}><EstadoComprobante estado={c.estado} /></td>
                  <td style={td}>
                    {Number(c.saldo) > 0 && <RegistrarPagoBtn comprobante={c} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function RegistrarPagoBtn({ comprobante }: { comprobante: any }) {
  const [open, setOpen] = useState(false)
  const [monto, setMonto] = useState(Number(comprobante.saldo))
  const [medio, setMedio] = useState('EFECTIVO')
  const crearPago = useCrearPago()

  async function pagar(e: React.FormEvent) {
    e.preventDefault()
    await crearPago.mutateAsync({
      comprobante_id: comprobante.id,
      paciente_id: comprobante.paciente.id,
      monto: Number(monto),
      medio,
    })
    setOpen(false)
  }

  if (!open) return <button onClick={() => setOpen(true)} style={btnSmall}>Registrar pago</button>

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={pagar} style={{ background: 'var(--surface)', borderRadius: 12, padding: 24, width: 420, boxShadow: 'var(--shadow-lg)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Registrar pago</h3>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
          Comprobante {comprobante.numero ?? comprobante.id.slice(-8).toUpperCase()} · Saldo ${Number(comprobante.saldo).toLocaleString('es-AR')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={labelStyle}>Monto *</div>
            <input type="number" min={1} step={100} value={monto} onChange={(e) => setMonto(Number(e.target.value))} required style={input} />
          </div>
          <div>
            <div style={labelStyle}>Medio *</div>
            <select value={medio} onChange={(e) => setMedio(e.target.value)} style={input}>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="DEBITO">Débito</option>
              <option value="CREDITO">Crédito</option>
              <option value="MERCADOPAGO">Mercado Pago</option>
              <option value="COBERTURA">Cobertura (cobra obra social)</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={() => setOpen(false)} style={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={crearPago.isPending} style={btnPrimary}>{crearPago.isPending ? 'Registrando...' : 'Registrar'}</button>
        </div>
      </form>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Deudas
// ════════════════════════════════════════════════════════════════

function TabDeudas() {
  const { data, isLoading } = useDeudas()
  const total = (data ?? []).reduce((s: number, d: any) => s + Number(d.saldo_actual), 0)

  return (
    <div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Deuda total</div>
        <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--danger)' }}>${total.toLocaleString('es-AR')}</div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {isLoading ? <Empty texto="Cargando..." /> : (data ?? []).length === 0 ? <Empty texto="Sin deudas pendientes. 👌" /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-2)', textAlign: 'left' }}>
                <th style={th}>Paciente</th>
                <th style={th}>DNI</th>
                <th style={th}>Origen</th>
                <th style={th}>Monto original</th>
                <th style={th}>Saldo actual</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((d: any) => (
                <tr key={d.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}><Link href={`/admin/pacientes/${d.paciente.id}`} style={{ color: 'var(--teal)' }}>{d.paciente.apellido}, {d.paciente.nombre}</Link></td>
                  <td style={td}>{d.paciente.dni}</td>
                  <td style={td}>{format(new Date(d.fecha_origen), 'dd/MM/yyyy')}</td>
                  <td style={td}>${Number(d.monto_original).toLocaleString('es-AR')}</td>
                  <td style={td}><strong style={{ color: 'var(--danger)' }}>${Number(d.saldo_actual).toLocaleString('es-AR')}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// Nuevo comprobante
// ════════════════════════════════════════════════════════════════

function TabNuevoComprobante({ onSuccess }: { onSuccess: () => void }) {
  const [busq, setBusq] = useState('')
  const [pacienteId, setPacienteId] = useState('')
  const [pacienteLabel, setPacienteLabel] = useState('')
  const [tipo, setTipo] = useState('RECIBO')
  const [items, setItems] = useState<Array<{ descripcion: string; cantidad: number; precio: number }>>([{ descripcion: '', cantidad: 1, precio: 0 }])
  const [descuento, setDescuento] = useState(0)
  const [obs, setObs] = useState('')

  const pacientes = useBuscarPacientes(busq)
  const prestaciones = usePrestaciones()
  const crear = useCrearComprobante()

  const subtotal = items.reduce((s, it) => s + it.cantidad * it.precio, 0)
  const total = Math.max(0, subtotal - descuento)

  function actualizarItem(i: number, patch: Partial<typeof items[0]>) {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!pacienteId || items.length === 0) return
    const body = {
      paciente_id: pacienteId,
      tipo,
      descuento,
      observaciones: obs || undefined,
      items: items.map((it) => ({ descripcion: it.descripcion, cantidad: it.cantidad, precio_unitario: it.precio })),
    }
    await crear.mutateAsync(body)
    onSuccess()
  }

  return (
    <form onSubmit={guardar} style={{ maxWidth: 900 }}>
      <Card titulo="Paciente">
        {pacienteId ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--teal-l)', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--teal-d)', fontWeight: 500 }}>{pacienteLabel}</span>
            <button type="button" onClick={() => { setPacienteId(''); setPacienteLabel(''); setBusq('') }} style={iconBtn}>cambiar</button>
          </div>
        ) : (
          <>
            <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar por DNI, apellido..." style={input} />
            {busq.length >= 2 && pacientes.data && pacientes.data.data.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginTop: 6, maxHeight: 200, overflowY: 'auto' }}>
                {pacientes.data.data.slice(0, 10).map((p: any) => (
                  <div key={p.id} onClick={() => { setPacienteId(p.id); setPacienteLabel(`${p.apellido}, ${p.nombre} · DNI ${p.dni}`) }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--border-2)' }}>
                    {p.apellido}, {p.nombre} <span style={{ color: 'var(--muted)' }}>· {p.dni}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <Card titulo="Tipo de comprobante">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...input, maxWidth: 260 }}>
          <option value="RECIBO">Recibo</option>
          <option value="FACTURA">Factura</option>
          <option value="PRESUPUESTO">Presupuesto</option>
        </select>
      </Card>

      <Card titulo="Items">
        {items.map((it, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 120px 120px 30px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              list="prestaciones-list"
              value={it.descripcion}
              onChange={(e) => {
                const desc = e.target.value
                const found = prestaciones.data?.find((p: any) => p.nombre === desc)
                actualizarItem(i, { descripcion: desc, precio: found ? Number(found.precio_particular) : it.precio })
              }}
              placeholder="Prestación..."
              style={input}
            />
            <input type="number" min={1} value={it.cantidad} onChange={(e) => actualizarItem(i, { cantidad: Number(e.target.value) })} style={input} />
            <input type="number" min={0} step={100} value={it.precio} onChange={(e) => actualizarItem(i, { precio: Number(e.target.value) })} style={input} placeholder="Precio" />
            <div style={{ fontSize: 13, color: 'var(--noir)', fontWeight: 500, textAlign: 'right' }}>${(it.cantidad * it.precio).toLocaleString('es-AR')}</div>
            <button type="button" onClick={() => setItems((arr) => arr.filter((_, idx) => idx !== i))} style={iconBtn} disabled={items.length === 1}>×</button>
          </div>
        ))}
        <datalist id="prestaciones-list">
          {prestaciones.data?.map((p: any) => <option key={p.id} value={p.nombre} />)}
        </datalist>
        <button type="button" onClick={() => setItems((arr) => [...arr, { descripcion: '', cantidad: 1, precio: 0 }])} style={{ ...btnSecondary, fontSize: 12 }}>+ Item</button>
      </Card>

      <Card titulo="Totales y observaciones">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16 }}>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} placeholder="Observaciones (opcional)" style={{ ...input, resize: 'vertical' }} />
          <div>
            <Row k="Subtotal" v={`$${subtotal.toLocaleString('es-AR')}`} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>Descuento</span>
              <input type="number" min={0} value={descuento} onChange={(e) => setDescuento(Number(e.target.value))} style={{ ...input, maxWidth: 100, textAlign: 'right' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--teal)' }}>${total.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="submit" disabled={crear.isPending || !pacienteId || items.some((it) => !it.descripcion)} style={btnPrimary}>
          {crear.isPending ? 'Emitiendo...' : 'Emitir comprobante'}
        </button>
      </div>
    </form>
  )
}

// ════════════════════════════════════════════════════════════════
// Helpers
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
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }}>
      <span style={{ color: 'var(--muted)' }}>{k}</span>
      <span style={{ color: 'var(--noir)', fontWeight: 500 }}>{v}</span>
    </div>
  )
}
function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: color ?? 'var(--noir)' }}>{value}</div>
    </div>
  )
}
function EstadoComprobante({ estado }: { estado: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    PAGADO: { bg: 'var(--salud-l)', fg: 'var(--salud)' },
    PAGO_PARCIAL: { bg: 'var(--warning-l)', fg: 'var(--warning)' },
    EMITIDO: { bg: 'var(--info-l)', fg: 'var(--info)' },
    BORRADOR: { bg: 'var(--bg-2)', fg: 'var(--muted)' },
    ANULADO: { bg: 'var(--danger-l)', fg: 'var(--danger)' },
  }
  const c = colors[estado] ?? { bg: 'var(--bg-2)', fg: 'var(--noir)' }
  return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>{estado.replace('_', ' ')}</span>
}
function Empty({ texto }: { texto: string }) { return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>{texto}</div> }

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 500, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }
const td: React.CSSProperties = { padding: '12px', color: 'var(--noir)' }
const input: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }
const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }
const btnPrimary: React.CSSProperties = { padding: '10px 18px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '10px 18px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, cursor: 'pointer' }
const btnSmall: React.CSSProperties = { padding: '4px 10px', background: 'var(--teal)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer' }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer' }
