'use client'

import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import s from './tablero.module.css'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com'

type EstadoTurno =
  | 'PENDIENTE'
  | 'PENDIENTE_PAGO_MP'
  | 'PENDIENTE_VALIDACION_MANUAL'
  | 'CONFIRMADO'
  | 'EN_CURSO'
  | 'PENDIENTE_FACTURAR'
  | 'COMPLETADO'
  | 'CANCELADO'
  | 'NO_SHOW'
  | 'VENCIDO'
  | 'RECHAZADO'

interface Turno {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin?: string
  duracion_min?: number
  estado: EstadoTurno
  canal?: string
  sena_pagada?: boolean
  notas?: string
  cliente?: { id: string; nombre: string; apellido: string; telefono?: string }
  profesional?: { id: string; nombre: string; apellido: string; color?: string }
  servicio?: { id: string; nombre: string; duracion_min?: number }
}

const COLUMNAS: { key: EstadoTurno; label: string; className: string }[] = [
  { key: 'PENDIENTE',                   label: 'Pendiente',         className: s.colPendiente      },
  { key: 'PENDIENTE_PAGO_MP',           label: 'Pago MP pend.',     className: s.colSena           },
  { key: 'PENDIENTE_VALIDACION_MANUAL', label: 'Validar transf.',   className: s.colSena           },
  { key: 'CONFIRMADO',                  label: 'Confirmado',        className: s.colConfirmado     },
  { key: 'EN_CURSO',                    label: 'En curso',          className: s.colEnCurso        },
  { key: 'PENDIENTE_FACTURAR',          label: 'Pend. facturar',    className: s.colPendFacturar   },
  { key: 'COMPLETADO',                  label: 'Completado',        className: s.colCompletado     },
  { key: 'CANCELADO',                   label: 'Cancelado',         className: s.colCancelado      },
]

const ACCIONES: Record<string, { label: string; next: EstadoTurno; cls: string }[]> = {
  PENDIENTE:                   [{ label: 'Confirmar', next: 'CONFIRMADO', cls: s.actionBtnPrimary }, { label: 'Cancelar', next: 'CANCELADO', cls: s.actionBtnDanger }],
  PENDIENTE_PAGO_MP:           [{ label: 'Confirmar', next: 'CONFIRMADO', cls: s.actionBtnPrimary }, { label: 'Cancelar', next: 'CANCELADO', cls: s.actionBtnDanger }],
  PENDIENTE_VALIDACION_MANUAL: [{ label: 'Ver comprobante', next: 'PENDIENTE_VALIDACION_MANUAL', cls: s.actionBtnPrimary }, { label: 'Cancelar', next: 'CANCELADO', cls: s.actionBtnDanger }],
  CONFIRMADO:                  [{ label: 'Iniciar', next: 'EN_CURSO', cls: s.actionBtnSuccess }, { label: 'No asistió', next: 'NO_SHOW', cls: s.actionBtnDanger }],
  EN_CURSO:                    [{ label: 'Finalizar servicio', next: 'PENDIENTE_FACTURAR', cls: s.actionBtnSuccess }],
  PENDIENTE_FACTURAR:          [],
  COMPLETADO:                  [],
  CANCELADO:                   [{ label: 'Reabrir', next: 'PENDIENTE', cls: '' }],
  NO_SHOW:                     [{ label: 'Reabrir', next: 'PENDIENTE', cls: '' }],
  VENCIDO:                     [{ label: 'Reabrir', next: 'PENDIENTE', cls: '' }],
  RECHAZADO:                   [{ label: 'Reabrir', next: 'PENDIENTE', cls: '' }],
}

function formatFecha(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

const CANAL_CLASS: Record<string, string> = {
  ADMIN:        s.canalLocal,
  LINK_PUBLICO: s.canalWeb,
  WHATSAPP:     s.canalWa,
  INSTAGRAM:    s.canalTelefono,
  TIENDANUBE:   s.canalWeb,
}

const CANAL_LABEL: Record<string, string> = {
  ADMIN:        'Local',
  LINK_PUBLICO: 'Web',
  WHATSAPP:     'WA',
  INSTAGRAM:    'IG',
  TIENDANUBE:   'TN',
}

function canalClass(canal?: string) {
  return CANAL_CLASS[canal ?? 'ADMIN'] ?? s.canalLocal
}

function canalLabel(canal?: string) {
  return CANAL_LABEL[canal ?? 'ADMIN'] ?? 'Local'
}

function TableroKanbanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fecha, setFecha] = useState(todayStr())
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Turno | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  // Si llega ?turno=ID (desde una notificación o link directo), abrir
  // el detalle de ese turno y posicionar el tablero en su fecha.
  useEffect(() => {
    const turnoIdParam = searchParams.get('turno')
    if (!turnoIdParam) return
    const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api-delfina.fluxtic.com')
    fetch(`${apiUrl}/turnos/${turnoIdParam}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        const t: Turno | null = json?.data ?? json ?? null
        if (!t) return
        // Posicionar el tablero en la fecha del turno
        const fechaTurno = (t.fecha || '').slice(0, 10)
        if (fechaTurno) setFecha(fechaTurno)
        setSelected(t)
        // Limpiar el query param para que no reabra el panel al cerrarlo
        router.replace('/admin/turnos/tablero', { scroll: false })
      })
      .catch(() => {/* silenciar */})
  }, [searchParams, router])

  const fetchTurnos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/turnos?fecha=${fecha}&limit=200`)
      const json = await res.json()
      setTurnos(json.data ?? json ?? [])
    } catch {
      showToast('Error al cargar turnos', false)
    } finally {
      setLoading(false)
    }
  }, [fecha])

  useEffect(() => { fetchTurnos() }, [fetchTurnos])

  const cambiarEstado = async (turnoId: string, nuevoEstado: EstadoTurno) => {
    setUpdating(turnoId)
    try {
      const res = await fetch(`${API}/turnos/${turnoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      })
      if (!res.ok) throw new Error()
      setTurnos(prev => prev.map(t => t.id === turnoId ? { ...t, estado: nuevoEstado } : t))
      if (selected?.id === turnoId) setSelected(prev => prev ? { ...prev, estado: nuevoEstado } : null)
      showToast('Estado actualizado')
    } catch {
      showToast('Error al actualizar estado', false)
    } finally {
      setUpdating(null)
    }
  }

  const byEstado = (estado: EstadoTurno) =>
    turnos.filter(t => t.estado === estado).sort((a, b) => (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))

  const total = turnos.filter(t => !['CANCELADO', 'NO_SHOW', 'VENCIDO', 'RECHAZADO'].includes(t.estado)).length
  const completados = turnos.filter(t => t.estado === 'COMPLETADO').length
  const enCurso = turnos.filter(t => t.estado === 'EN_CURSO').length

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.header}>
        <div>
          <div className={s.title}>Tablero de turnos</div>
          <div className={s.sub}>Vista kanban por estado · {formatFecha(fecha)}</div>
        </div>
        <div className={s.headerRight}>
          <div className={s.fechaNav}>
            <button className={s.fechaBtn} onClick={() => setFecha(f => addDays(f, -1))}>‹</button>
            <span className={s.fechaLabel}>{formatFecha(fecha)}</span>
            <button className={s.fechaBtn} onClick={() => setFecha(f => addDays(f, 1))}>›</button>
          </div>
          <button className={s.fechaHoy} onClick={() => setFecha(todayStr())}>Hoy</button>
        </div>
      </div>

      {/* Stat bar */}
      <div className={s.statBar}>
        <div className={s.statChip}><span className={s.statChipVal}>{total}</span>activos</div>
        <div className={s.statChip}><span className={s.statChipVal}>{enCurso}</span>en curso</div>
        <div className={s.statChip}><span className={s.statChipVal}>{completados}</span>completados</div>
        <div className={s.statChip}>
          <span className={s.statChipVal}>{turnos.filter(t => ['CANCELADO', 'NO_SHOW'].includes(t.estado)).length}</span>cancelados / no asistió
        </div>
      </div>

      {/* Board */}
      <div className={s.board}>
        {COLUMNAS.map(col => {
          const items = byEstado(col.key)
          return (
            <div key={col.key} className={`${s.col} ${col.className}`}>
              <div className={s.colHead}>
                <span className={s.colTitle}>{col.label}</span>
                <span className={s.colCount}>{items.length}</span>
              </div>
              <div className={s.cards}>
                {loading ? (
                  [0, 1].map(i => (
                    <div key={i} className={s.skCard}>
                      <div className={s.skeleton} style={{ height: 10, width: '60%' }} />
                      <div className={s.skeleton} style={{ height: 12, width: '90%' }} />
                      <div className={s.skeleton} style={{ height: 10, width: '75%' }} />
                    </div>
                  ))
                ) : items.length === 0 ? (
                  <div className={s.empty}>Sin turnos</div>
                ) : (
                  items.map(t => {
                    const nombre = t.cliente ? `${t.cliente.nombre} ${t.cliente.apellido}` : '—'
                    const servicio = t.servicio?.nombre ?? '—'
                    const acciones = ACCIONES[t.estado] ?? []
                    return (
                      <div key={t.id} className={s.card} onClick={() => setSelected(t)}>
                        <div className={s.cardTop}>
                          <span className={s.cardHora}>{t.hora_inicio?.slice(0, 5)}</span>
                          {t.duracion_min && <span className={s.cardDur}>{t.duracion_min}min</span>}
                        </div>
                        <div className={s.cardCliente}>{nombre}</div>
                        <div className={s.cardServicio}>{servicio}</div>
                        <div className={s.cardFooter}>
                          <span className={s.cardProf}>
                            {t.profesional && (
                              <span
                                className={s.cardProfDot}
                                style={{ background: t.profesional.color ?? '#ccc' }}
                              />
                            )}
                            {t.profesional ? `${t.profesional.nombre}` : '—'}
                          </span>
                          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                            <span className={`${s.canalChip} ${canalClass(t.canal)}`}>{canalLabel(t.canal)}</span>
                            {t.sena_pagada && <span className={s.senaBadge}>Seña ✓</span>}
                          </div>
                        </div>
                        {(acciones.length > 0 || ['CONFIRMADO', 'EN_CURSO', 'PENDIENTE_FACTURAR'].includes(t.estado)) && (
                          <div className={s.cardActions} onClick={e => e.stopPropagation()}>
                            {(['CONFIRMADO', 'EN_CURSO', 'PENDIENTE_FACTURAR'].includes(t.estado)) && (
                              <button
                                className={`${s.actionBtn} ${s.actionBtnCobrar}`}
                                onClick={() => router.push(`/admin/caja?turnoId=${t.id}`)}
                              >
                                💰 Cobrar
                              </button>
                            )}
                            {acciones.map(a => (
                              <button
                                key={a.next}
                                className={`${s.actionBtn} ${a.cls}`}
                                disabled={updating === t.id}
                                onClick={() => cambiarEstado(t.id, a.next)}
                              >
                                {updating === t.id ? '…' : a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className={s.overlay} onClick={() => setSelected(null)}>
          <div className={s.modal} onClick={e => e.stopPropagation()}>
            <div className={s.modalHead}>
              <span className={s.modalTitle}>Detalle del turno</span>
              <button className={s.modalClose} onClick={() => setSelected(null)}>×</button>
            </div>
            <div className={s.modalBody}>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Cliente</span>
                <span className={s.detailVal}>
                  {selected.cliente ? `${selected.cliente.nombre} ${selected.cliente.apellido}` : '—'}
                </span>
              </div>
              {selected.cliente?.telefono && (
                <div className={s.detailRow}>
                  <span className={s.detailLabel}>Teléfono</span>
                  <span className={s.detailVal}>{selected.cliente.telefono}</span>
                </div>
              )}
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Servicio</span>
                <span className={s.detailVal}>{selected.servicio?.nombre || '—'}</span>
              </div>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Profesional</span>
                <span className={s.detailVal}>
                  {selected.profesional ? `${selected.profesional.nombre} ${selected.profesional.apellido}` : '—'}
                </span>
              </div>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Fecha</span>
                <span className={s.detailVal}>{formatFecha(selected.fecha)}</span>
              </div>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Horario</span>
                <span className={s.detailVal}>
                  {selected.hora_inicio?.slice(0, 5)}{selected.hora_fin ? ` → ${selected.hora_fin.slice(0, 5)}` : ''}
                  {selected.duracion_min ? ` (${selected.duracion_min}min)` : ''}
                </span>
              </div>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Canal</span>
                <span className={s.detailVal}>{canalLabel(selected.canal)}</span>
              </div>
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Seña</span>
                <span className={s.detailVal}>{selected.sena_pagada ? 'Pagada ✓' : 'No'}</span>
              </div>
              {selected.notas && (
                <>
                  <div className={s.detailDivider} />
                  <div className={s.detailRow}>
                    <span className={s.detailLabel}>Notas</span>
                    <span className={s.detailVal}>{selected.notas}</span>
                  </div>
                </>
              )}
            </div>
            <div className={s.modalActions}>
              {(['CONFIRMADO', 'EN_CURSO', 'PENDIENTE_FACTURAR'].includes(selected.estado)) && (
                <button
                  className={`${s.modalBtn} ${s.modalBtnCobrar}`}
                  onClick={() => { setSelected(null); router.push(`/admin/caja?turnoId=${selected.id}`) }}
                >
                  💰 Cobrar turno
                </button>
              )}
              {(ACCIONES[selected.estado] ?? []).map(a => (
                <button
                  key={a.next}
                  className={`${s.modalBtn} ${
                    a.cls === s.actionBtnPrimary ? s.modalBtnPrimary :
                    a.cls === s.actionBtnSuccess ? s.modalBtnSuccess :
                    a.cls === s.actionBtnDanger  ? s.modalBtnDanger  : ''
                  }`}
                  disabled={updating === selected.id}
                  onClick={() => { cambiarEstado(selected.id, a.next); setSelected(null) }}
                >
                  {a.label}
                </button>
              ))}
              <button className={s.modalBtn} onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`${s.toast} ${toast.ok ? s.toastOk : s.toastErr}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}


export default function TableroKanban() {
  return (
    <Suspense fallback={null}>
      <TableroKanbanContent />
    </Suspense>
  )
}
