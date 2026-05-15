'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './whatsapp.module.css'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'

const N8N_WORKFLOWS = [
  { id: '6f3tybcMJr2mjkMP', nombre: 'WA — Recordatorio de Turno 24hs',  tipo: 'Recordatorio' },
  { id: '0keN95OIDL8yKN12', nombre: 'WA — Confirmación de Turno',         tipo: 'Confirmación' },
  { id: '6t6fU9WkEoLvau0d', nombre: 'WA — Cumpleaños de Clientes',        tipo: 'Cumpleaños'   },
]

interface Config {
  activa: boolean
  config: {
    confirmacion_activa: boolean
    recordatorio_activa: boolean
    cumpleanos_activa: boolean
    horas_antes_recordatorio: number
    plantilla_confirmacion: string
    plantilla_recordatorio: string
    plantilla_cumpleanos: string
  }
}

interface MensajeWA {
  id: string
  telefono: string
  tipo: string
  estado: string
  contenido: string
  sid: string | null
  createdAt: string
  cliente: { nombre: string; apellido: string | null } | null
}

interface Stats {
  hoy: {
    total: number
    fallidos: number
    confirmaciones: number
    recordatorios: number
    cumpleanos: number
  }
}

type Tab = 'config' | 'historial' | 'prueba'

const TIPO_CHIP: Record<string, string> = {
  CONFIRMACION: styles.chipConfirmacion,
  RECORDATORIO: styles.chipRecordatorio,
  CUMPLEANOS:   styles.chipCumpleanos,
  PRUEBA:       styles.chipPrueba,
}

const TIPO_LABEL: Record<string, string> = {
  CONFIRMACION: 'Confirmación',
  RECORDATORIO: 'Recordatorio',
  CUMPLEANOS:   'Cumpleaños',
  PRUEBA:       'Prueba',
}

const ESTADO_CHIP: Record<string, string> = {
  ENVIADO:   styles.chipEnviado,
  FALLIDO:   styles.chipFallido,
  PENDIENTE: styles.chipPendiente,
}

const defaultConfig: Config = {
  activa: false,
  config: {
    confirmacion_activa: true,
    recordatorio_activa: true,
    cumpleanos_activa: true,
    horas_antes_recordatorio: 24,
    plantilla_confirmacion: 'Hola {{nombre}} 👋 Tu turno para *{{servicio}}* está confirmado para el *{{fecha}}* a las *{{hora}}* con {{profesional}}. ¡Te esperamos!',
    plantilla_recordatorio: 'Hola {{nombre}} 😊 Te recordamos que mañana tenés turno para *{{servicio}}* a las *{{hora}}* con {{profesional}}. Respondé *SÍ* para confirmar o *NO* para cancelar.',
    plantilla_cumpleanos: '🎉 ¡Feliz cumpleaños {{nombre}}! Desde el equipo de Delfina Paz Beauty te deseamos un día increíble. ¡Tenemos un regalo especial para vos!',
  }
}

export default function WhatsAppPage() {
  const [tab, setTab] = useState<Tab>('config')
  const [cfg, setCfg] = useState<Config>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const [mensajes, setMensajes] = useState<MensajeWA[]>([])
  const [loadingHist, setLoadingHist] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [stats, setStats] = useState<Stats | null>(null)

  const [pruebaTel, setPruebaTel] = useState('')
  const [pruebaMsg, setPruebaMsg] = useState('')
  const [enviandoPrueba, setEnviandoPrueba] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const cargarConfig = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/whatsapp/config`)
      if (r.ok) setCfg(await r.json())
    } catch { /* usa defaults */ }
    finally { setLoading(false) }
  }, [])

  const cargarHistorial = useCallback(async () => {
    setLoadingHist(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filtroTipo) params.set('tipo', filtroTipo)
      if (filtroEstado) params.set('estado', filtroEstado)
      const r = await fetch(`${API_BASE}/whatsapp/historial?${params}`)
      if (r.ok) {
        const data = await r.json()
        setMensajes(data.data ?? [])
      }
    } catch { /* silence */ }
    finally { setLoadingHist(false) }
  }, [filtroTipo, filtroEstado])

  const cargarStats = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/whatsapp/stats`)
      if (r.ok) setStats(await r.json())
    } catch { /* silence */ }
  }, [])

  useEffect(() => { cargarConfig(); cargarStats() }, [cargarConfig, cargarStats])
  useEffect(() => { if (tab === 'historial') cargarHistorial() }, [tab, cargarHistorial])

  const guardarConfig = async () => {
    setSaving(true)
    try {
      await fetch(`${API_BASE}/whatsapp/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      showToast('Configuración guardada')
    } catch { showToast('Error al guardar') }
    finally { setSaving(false) }
  }

  const enviarPrueba = async () => {
    if (!pruebaTel.trim() || !pruebaMsg.trim()) return
    setEnviandoPrueba(true)
    try {
      const r = await fetch(`${API_BASE}/whatsapp/prueba`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: pruebaTel.trim(), mensaje: pruebaMsg.trim() }),
      })
      if (r.ok) {
        showToast('Prueba registrada · n8n enviará el mensaje')
        setPruebaTel('')
        setPruebaMsg('')
      } else {
        showToast('Error al registrar prueba')
      }
    } catch { showToast('Error de conexión') }
    finally { setEnviandoPrueba(false) }
  }

  const setConfigField = (field: keyof Config['config'], val: unknown) => {
    setCfg(prev => ({ ...prev, config: { ...prev.config, [field]: val } }))
  }

  const formatFecha = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
      ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <div className={styles.loading}>Cargando configuración…</div>

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>WhatsApp</h1>
          <p className={styles.pageSub}>Automatizaciones de mensajería · vía Twilio + n8n</p>
        </div>
        <div className={`${styles.statusBadge} ${cfg.activa ? styles.statusOn : styles.statusOff}`}>
          <span className={`${styles.statusDot} ${cfg.activa ? styles.dotOn : styles.dotOff}`} />
          {cfg.activa ? 'Activo' : 'Inactivo'}
        </div>
      </div>

      {stats && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{stats.hoy.total}</div>
            <div className={styles.statLabel}>Mensajes hoy</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{stats.hoy.confirmaciones}</div>
            <div className={styles.statLabel}>Confirmaciones</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{stats.hoy.recordatorios}</div>
            <div className={styles.statLabel}>Recordatorios</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNum}>{stats.hoy.fallidos}</div>
            <div className={styles.statLabel}>Fallidos</div>
          </div>
        </div>
      )}

      <div className={styles.tabs}>
        {(['config', 'historial', 'prueba'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}>
            {t === 'config' ? 'Configuración' : t === 'historial' ? 'Historial' : 'Prueba'}
          </button>
        ))}
      </div>

      {/* ─── TAB CONFIGURACIÓN ─── */}
      {tab === 'config' && (
        <div className={styles.grid}>
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionTitle}>Automatizaciones</div>
                <div className={styles.sectionSub}>Activá o desactivá cada tipo de mensaje</div>
              </div>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.cfgRow}>
                <div>
                  <div className={styles.cfgLabel}>WhatsApp global</div>
                  <div className={styles.cfgLabelSub}>Desactivar detiene todos los envíos</div>
                </div>
                <button className={`${styles.toggle} ${cfg.activa ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => setCfg(p => ({ ...p, activa: !p.activa }))} />
              </div>

              <div className={styles.cfgRow}>
                <div>
                  <div className={styles.cfgLabel}>Confirmación de turno</div>
                  <div className={styles.cfgLabelSub}>Se envía ~15min después de crear el turno</div>
                </div>
                <button className={`${styles.toggle} ${cfg.config.confirmacion_activa ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => setConfigField('confirmacion_activa', !cfg.config.confirmacion_activa)} />
              </div>

              <div className={styles.cfgRow}>
                <div>
                  <div className={styles.cfgLabel}>Recordatorio de turno</div>
                  <div className={styles.cfgLabelSub}>Enviado antes del turno (configurable)</div>
                </div>
                <button className={`${styles.toggle} ${cfg.config.recordatorio_activa ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => setConfigField('recordatorio_activa', !cfg.config.recordatorio_activa)} />
              </div>

              <div className={styles.cfgRow}>
                <div>
                  <div className={styles.cfgLabel}>Saludo de cumpleaños</div>
                  <div className={styles.cfgLabelSub}>Todos los días a las 9am</div>
                </div>
                <button className={`${styles.toggle} ${cfg.config.cumpleanos_activa ? styles.toggleOn : styles.toggleOff}`}
                  onClick={() => setConfigField('cumpleanos_activa', !cfg.config.cumpleanos_activa)} />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Horas de anticipación (recordatorio)</label>
                <input type="number" className={styles.formInp} min={1} max={72}
                  value={cfg.config.horas_antes_recordatorio}
                  onChange={e => setConfigField('horas_antes_recordatorio', parseInt(e.target.value) || 24)} />
                <span className={styles.formHint}>El workflow buscará turnos en las próximas {cfg.config.horas_antes_recordatorio}hs</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionTitle}>Workflows n8n</div>
                <div className={styles.sectionSub}>Gestioná los flujos desde n8n</div>
              </div>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.workflowLinks}>
                {N8N_WORKFLOWS.map(wf => (
                  <a key={wf.id} href={`https://n8n-salud.fluxtic.com/workflow/${wf.id}`}
                    target="_blank" rel="noopener noreferrer" className={styles.workflowLink}
                    style={{ textDecoration: 'none' }}>
                    <div>
                      <div className={styles.workflowName}>{wf.nombre}</div>
                      <div className={styles.workflowId}>{wf.id}</div>
                    </div>
                    <span className={`${styles.workflowBadge} ${styles.badgePausado}`}>
                      Ver →
                    </span>
                  </a>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#8C847A', lineHeight: 1.5 }}>
                Configurá <code>TWILIO_WA_FROM</code> e <code>INTERNAL_API_TOKEN</code> en las variables de entorno de n8n.
              </p>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>Plantilla — Confirmación</div>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Mensaje</label>
                <textarea className={styles.formArea} rows={4}
                  value={cfg.config.plantilla_confirmacion}
                  onChange={e => setConfigField('plantilla_confirmacion', e.target.value)} />
                <span className={styles.formHint}>Variables: {'{{nombre}}'} {'{{servicio}}'} {'{{profesional}}'} {'{{fecha}}'} {'{{hora}}'}</span>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>Plantilla — Recordatorio</div>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Mensaje</label>
                <textarea className={styles.formArea} rows={4}
                  value={cfg.config.plantilla_recordatorio}
                  onChange={e => setConfigField('plantilla_recordatorio', e.target.value)} />
                <span className={styles.formHint}>Variables: {'{{nombre}}'} {'{{servicio}}'} {'{{profesional}}'} {'{{hora}}'}</span>
              </div>
            </div>
          </div>

          <div className={`${styles.section} ${styles.sectionFull}`}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>Plantilla — Cumpleaños</div>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Mensaje</label>
                <textarea className={styles.formArea} rows={3}
                  value={cfg.config.plantilla_cumpleanos}
                  onChange={e => setConfigField('plantilla_cumpleanos', e.target.value)} />
                <span className={styles.formHint}>Variables: {'{{nombre}}'}</span>
              </div>
            </div>
          </div>

          <div className={`${styles.section} ${styles.sectionFull}`}
            style={{ background: 'transparent', border: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className={styles.btnPrimary} onClick={guardarConfig} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB HISTORIAL ─── */}
      {tab === 'historial' && (
        <div className={styles.section}>
          <div className={styles.filters}>
            <span style={{ fontSize: 11, color: '#8C847A', marginRight: 4 }}>Filtrar:</span>
            <select className={styles.filterSelect} value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="CONFIRMACION">Confirmación</option>
              <option value="RECORDATORIO">Recordatorio</option>
              <option value="CUMPLEANOS">Cumpleaños</option>
              <option value="PRUEBA">Prueba</option>
            </select>
            <select className={styles.filterSelect} value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="ENVIADO">Enviado</option>
              <option value="FALLIDO">Fallido</option>
              <option value="PENDIENTE">Pendiente</option>
            </select>
            <button className={styles.btnGhost} onClick={cargarHistorial}>Actualizar</button>
          </div>

          {loadingHist ? (
            <div className={styles.loading}>Cargando historial…</div>
          ) : mensajes.length === 0 ? (
            <div className={styles.empty}>Sin mensajes registrados todavía</div>
          ) : (
            <div className={styles.tblWrap}>
              <table className={styles.tbl}>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Cliente</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th>SID Twilio</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {mensajes.map(m => (
                    <tr key={m.id}>
                      <td>
                        <span className={TIPO_CHIP[m.tipo] ?? styles.chipPrueba}>
                          {TIPO_LABEL[m.tipo] ?? m.tipo}
                        </span>
                      </td>
                      <td>
                        {m.cliente
                          ? `${m.cliente.nombre} ${m.cliente.apellido ?? ''}`.trim()
                          : <span style={{ color: '#8C847A' }}>—</span>}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{m.telefono}</td>
                      <td>
                        <span className={ESTADO_CHIP[m.estado] ?? styles.chipPendiente}>
                          {m.estado === 'ENVIADO' ? 'Enviado' : m.estado === 'FALLIDO' ? 'Fallido' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#8C847A' }}>
                        {m.sid ?? '—'}
                      </td>
                      <td style={{ fontSize: 11.5, color: '#8C847A', whiteSpace: 'nowrap' }}>
                        {formatFecha(m.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB PRUEBA ─── */}
      {tab === 'prueba' && (
        <div className={styles.grid}>
          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div>
                <div className={styles.sectionTitle}>Envío de prueba</div>
                <div className={styles.sectionSub}>El mensaje se encola en n8n vía Twilio</div>
              </div>
            </div>
            <div className={styles.sectionBody}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Teléfono destino</label>
                <input type="tel" className={styles.formInp} placeholder="+5491100000000"
                  value={pruebaTel} onChange={e => setPruebaTel(e.target.value)} />
                <span className={styles.formHint}>Formato internacional con código de país</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Mensaje</label>
                <textarea className={styles.formArea} rows={5} placeholder="Escribí el mensaje de prueba…"
                  value={pruebaMsg} onChange={e => setPruebaMsg(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button className={styles.btnWa} onClick={enviarPrueba}
                  disabled={enviandoPrueba || !pruebaTel || !pruebaMsg}>
                  {enviandoPrueba ? 'Registrando…' : '📱 Enviar prueba'}
                </button>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <div className={styles.sectionTitle}>Cómo funciona</div>
            </div>
            <div className={styles.sectionBody}>
              <div style={{ fontSize: 12.5, color: '#3A342E', lineHeight: 1.7 }}>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>1. Registrar prueba</strong> — El botón crea un registro con estado <em>PENDIENTE</em>.
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>2. n8n + Twilio</strong> — Los workflows envían el mensaje por WhatsApp.
                </p>
                <p style={{ margin: '0 0 10px' }}>
                  <strong>3. Estado actualizado</strong> — Cuando Twilio confirma, el estado pasa a <em>ENVIADO</em>.
                </p>
              </div>
              <div style={{ padding: '10px 14px', background: '#F3F0EC', borderRadius: 8, fontSize: 11.5, color: '#8C847A', lineHeight: 1.6 }}>
                Asegurate de que el número esté habilitado en Twilio y que los workflows de n8n estén activos.
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  )
}
