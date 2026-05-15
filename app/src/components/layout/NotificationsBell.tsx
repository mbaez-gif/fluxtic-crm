'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import s from './NotificationsBell.module.css'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api-salud.fluxtic.com'
const POLL_MS = 30_000

type Tipo =
  | 'TURNO_NUEVO'
  | 'TURNO_CONFIRMADO'
  | 'TURNO_CANCELADO'
  | 'TURNO_VENCIDO'
  | 'PAGO_APROBADO'
  | 'PAGO_RECHAZADO'
  | 'COMPROBANTE_PENDIENTE'
  | 'COMPROBANTE_APROBADO'
  | 'SISTEMA'

interface Notif {
  id: string
  tipo: Tipo
  titulo: string
  mensaje: string
  referencia_id: string | null
  url_destino: string | null
  leida: boolean
  leida_at: string | null
  createdAt: string
}

const ICON: Record<Tipo, { emoji: string; klass: string }> = {
  TURNO_NUEVO:            { emoji: '📅', klass: 'iconNuevo' },
  TURNO_CONFIRMADO:       { emoji: '✓',  klass: 'iconConfirmado' },
  TURNO_CANCELADO:        { emoji: '✕',  klass: 'iconCancelado' },
  TURNO_VENCIDO:          { emoji: '⏱',  klass: 'iconVencido' },
  PAGO_APROBADO:          { emoji: '💳', klass: 'iconAprobado' },
  PAGO_RECHAZADO:         { emoji: '⚠',  klass: 'iconRechazado' },
  COMPROBANTE_PENDIENTE:  { emoji: '📎', klass: 'iconPendiente' },
  COMPROBANTE_APROBADO:   { emoji: '✓',  klass: 'iconAprobado' },
  SISTEMA:                { emoji: 'ℹ',  klass: 'iconSistema' },
}

export default function NotificationsBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [count, setCount] = useState(0)
  const [marking, setMarking] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const cargarConteo = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/notificaciones/no-leidas`)
      if (!r.ok) return
      const j = await r.json()
      setCount(j.count ?? 0)
    } catch { /* silenciar */ }
  }, [])

  const cargarLista = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/notificaciones?limit=30`)
      if (!r.ok) return
      const j = await r.json()
      setNotifs(j.data ?? [])
    } catch { /* silenciar */ }
  }, [])

  // Poll del contador cada POLL_MS
  useEffect(() => {
    cargarConteo()
    const id = setInterval(cargarConteo, POLL_MS)
    return () => clearInterval(id)
  }, [cargarConteo])

  // Cerrar al click fuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', onClickOutside)
      return () => document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  function abrir() {
    setOpen(o => {
      const nuevo = !o
      if (nuevo) cargarLista()
      return nuevo
    })
  }

  async function marcarLeida(id: string) {
    try {
      await fetch(`${API_URL}/notificaciones/${id}/leida`, { method: 'PATCH' })
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
      setCount(c => Math.max(0, c - 1))
    } catch { /* silenciar */ }
  }

  async function marcarTodas() {
    if (count === 0) return
    setMarking(true)
    try {
      await fetch(`${API_URL}/notificaciones/marcar-todas`, { method: 'POST' })
      setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
      setCount(0)
    } catch { /* silenciar */ }
    setMarking(false)
  }

  function handleClick(n: Notif) {
    if (!n.leida) marcarLeida(n.id)
    if (n.url_destino) {
      router.push(n.url_destino)
      setOpen(false)
    }
  }

  return (
    <div ref={wrapRef} className={s.wrap}>
      <button
        type="button"
        className={s.bell}
        onClick={abrir}
        aria-label="Notificaciones"
        title="Notificaciones"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && (
          <span key={count} className={s.badge}>{count > 99 ? '99+' : count}</span>
        )}
      </button>

      {open && (
        <div className={s.panel} role="dialog" aria-label="Notificaciones">
          <div className={s.panelHead}>
            <span className={s.panelTitle}>Notificaciones</span>
            <button
              type="button"
              className={s.markAll}
              onClick={marcarTodas}
              disabled={marking || count === 0}
            >
              Marcar todas
            </button>
          </div>

          <div className={s.list}>
            {notifs.length === 0 ? (
              <div className={s.empty}>
                <strong>Sin novedades</strong>
                Cuando ocurra algo en el sistema, te avisamos por acá.
              </div>
            ) : (
              notifs.map(n => {
                const icon = ICON[n.tipo] ?? ICON.SISTEMA
                return (
                  <div
                    key={n.id}
                    className={`${s.item} ${!n.leida ? s.itemUnread : ''}`}
                    onClick={() => handleClick(n)}
                  >
                    <div className={`${s.icon} ${s[icon.klass] ?? ''}`}>{icon.emoji}</div>
                    <div className={s.body}>
                      <p className={s.titulo}>{n.titulo}</p>
                      <p className={s.mensaje}>{n.mensaje}</p>
                      <p className={s.tiempo}>{tiempoRelativo(n.createdAt)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className={s.panelFoot}>
            Se actualiza cada 30 segundos
          </div>
        </div>
      )}
    </div>
  )
}

function tiempoRelativo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'hace un instante'
  if (min < 60) return `hace ${min} min`
  const hs = Math.floor(min / 60)
  if (hs < 24) return `hace ${hs} h`
  const dias = Math.floor(hs / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}
