'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuthContext }  from '@/components/auth/AuthProvider'
import { db }              from '@/lib/firebase/config'
import {
  collection, query, where, orderBy,
  limit, onSnapshot,
} from 'firebase/firestore'
import { markAsRead, markAllAsRead, archiveNotification } from '@/lib/firebase/notifications'
import type { Notification } from '@/types/notifications'
import { NOTIF_CONFIG }    from '@/types/notifications'
import { cn }              from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { es }              from 'date-fns/locale'
import {
  Bell, BellRing, Check, CheckCheck,
  X, Archive, ExternalLink, Inbox,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date()
}

function timeAgo(ts: any): string {
  const d = toDate(ts)
  if (isToday(d))     return format(d, 'HH:mm')
  if (isYesterday(d)) return 'Ayer'
  return format(d, "d MMM", { locale: es })
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-400',
  high:   'bg-amber-400',
  medium: 'bg-blue-400',
  low:    'bg-slate-400',
}

interface NotifItemProps {
  notif:    Notification
  onRead:   (id: string) => void
  onArchive:(id: string) => void
  onClick:  (notif: Notification) => void
}

function NotifItem({ notif, onRead, onArchive, onClick }: NotifItemProps) {
  const cfg = NOTIF_CONFIG[notif.tipo]

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 border-b border-white/5 transition-colors group relative',
        notif.leida ? 'opacity-70' : 'bg-white/[0.02]',
        'hover:bg-white/[0.04] cursor-pointer'
      )}
      onClick={() => onClick(notif)}
    >
      {/* Unread dot */}
      {!notif.leida && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-blue-400" />
      )}

      {/* Icon */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-0.5"
        style={{ background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
      >
        {cfg.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className="text-2xs font-bold uppercase tracking-wider"
              style={{ color: cfg.color }}
            >
              {cfg.label}
            </span>
            <div className={cn('w-1 h-1 rounded-full shrink-0', PRIORITY_DOT[notif.prioridad])} />
          </div>
          <span className="text-2xs text-slate-500 shrink-0">{timeAgo(notif.creadoEn)}</span>
        </div>
        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed line-clamp-2">
          {notif.descripcion}
        </p>
      </div>

      {/* Actions — show on hover */}
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!notif.leida && (
          <button
            onClick={e => { e.stopPropagation(); onRead(notif.id) }}
            title="Marcar como leída"
            className="p-1 rounded text-slate-500 hover:text-blue-400 transition-colors"
          >
            <Check size={12} />
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onArchive(notif.id) }}
          title="Archivar"
          className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Archive size={12} />
        </button>
      </div>
    </div>
  )
}

export function NotificationBell() {
  const { user }     = useAuthContext()
  const router       = useRouter()
  const [open,       setOpen]       = useState(false)
  const [notifs,     setNotifs]     = useState<Notification[]>([])
  const [filter,     setFilter]     = useState<'all' | 'unread'>('all')
  const [markingAll, setMarkingAll] = useState(false)
  const ref          = useRef<HTMLDivElement>(null)

  const unreadCount = notifs.filter(n => !n.leida).length

  // Real-time subscription
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'notifications'),
      where('destinatarioUid', '==', user.uid),
      where('archivada', '==', false),
      orderBy('creadoEn', 'desc'),
      limit(50)
    )
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Notification))
    })
    return unsub
  }, [user])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleRead(id: string) {
    await markAsRead(id)
  }

  async function handleArchive(id: string) {
    await archiveNotification(id)
  }

  async function handleMarkAllRead() {
    if (!user) return
    setMarkingAll(true)
    await markAllAsRead(user.uid)
    setMarkingAll(false)
  }

  function handleClick(notif: Notification) {
    if (!notif.leida) markAsRead(notif.id)
    if (notif.href) { router.push(notif.href); setOpen(false) }
  }

  const displayed = filter === 'unread' ? notifs.filter(n => !n.leida) : notifs

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'relative p-2 rounded-xl transition-all',
          open
            ? 'bg-blue-500/20 text-blue-400'
            : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
        )}
      >
        {unreadCount > 0
          ? <BellRing size={20} className="animate-[wiggle_0.5s_ease-in-out]" />
          : <Bell size={20} />
        }
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-2xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', fontSize: 10, padding: '0 4px' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-white/8 shadow-2xl overflow-hidden z-50"
          style={{ background: '#0d1829' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-slate-400" />
              <p className="font-semibold text-slate-200 text-sm">Notificaciones</p>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-2xs font-bold bg-blue-500/20 text-blue-400">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  title="Marcar todas como leídas"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 transition-colors"
                >
                  <CheckCheck size={15} />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300">
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex border-b border-white/8">
            {(['all', 'unread'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn(
                  'flex-1 py-2.5 text-xs font-medium transition-all',
                  filter === f
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-slate-500 hover:text-slate-300'
                )}>
                {f === 'all' ? 'Todas' : `Sin leer (${unreadCount})`}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {displayed.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Inbox size={20} className="text-slate-500" />
                </div>
                <p className="text-sm text-slate-500">
                  {filter === 'unread' ? 'Sin notificaciones nuevas' : 'Sin notificaciones'}
                </p>
              </div>
            ) : (
              displayed.map(n => (
                <NotifItem
                  key={n.id}
                  notif={n}
                  onRead={handleRead}
                  onArchive={handleArchive}
                  onClick={handleClick}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="px-4 py-2.5 border-t border-white/8 flex justify-between items-center">
              <p className="text-2xs text-slate-600">{notifs.length} notificaciones</p>
              <button
                onClick={() => { router.push('/notificaciones'); setOpen(false) }}
                className="text-2xs text-blue-400 hover:underline flex items-center gap-1"
              >
                Ver todas <ExternalLink size={10} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
