'use client'

import { useState, useEffect }  from 'react'
import { useAuthContext }        from '@/components/auth/AuthProvider'
import { PageHeader }            from '@/components/layout/PageHeader'
import { Spinner }               from '@/components/ui'
import { db }                    from '@/lib/firebase/config'
import {
  collection, query, where, orderBy,
  onSnapshot, limit,
} from 'firebase/firestore'
import {
  markAsRead, markAllAsRead,
  archiveNotification,
} from '@/lib/firebase/notifications'
import type { Notification, NotificationType } from '@/types/notifications'
import { NOTIF_CONFIG }          from '@/types/notifications'
import { cn }                    from '@/lib/utils'
import { format }                from 'date-fns'
import { es }                    from 'date-fns/locale'
import { useRouter }             from 'next/navigation'
import {
  Bell, CheckCheck, Archive, Inbox,
  Users, MessageCircle, TrendingUp,
  FileText, CreditCard, CheckSquare,
  Building2, DollarSign,
} from 'lucide-react'

function toDate(ts: any): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  if (typeof ts === 'string') return new Date(ts)
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date()
}

const CATEGORIES = [
  { id: 'all',          label: 'Todas',        icon: Bell          },
  { id: 'leads',        label: 'Leads',        icon: Users         },
  { id: 'wa',           label: 'WhatsApp',     icon: MessageCircle },
  { id: 'ventas',       label: 'Ventas',       icon: TrendingUp    },
  { id: 'admin',        label: 'Admin',        icon: DollarSign    },
  { id: 'operaciones',  label: 'Operaciones',  icon: CheckSquare   },
]

const TYPE_CATEGORY: Record<NotificationType, string> = {
  nuevo_lead:            'leads',
  lead_calificado:       'leads',
  nueva_conversacion_wa: 'wa',
  mensaje_wa:            'wa',
  nueva_oportunidad:     'ventas',
  oportunidad_ganada:    'ventas',
  oportunidad_perdida:   'ventas',
  nueva_propuesta:       'ventas',
  propuesta_aceptada:    'ventas',
  vencimiento_abono:     'admin',
  nuevo_gasto:           'admin',
  cierre_mensual:        'admin',
  tarea_vencida:         'operaciones',
  nuevo_cliente:         'operaciones',
}

export default function NotificacionesPage() {
  const { user }      = useAuthContext()
  const router        = useRouter()
  const [notifs,      setNotifs]      = useState<Notification[]>([])
  const [loading,     setLoading]     = useState(true)
  const [category,    setCategory]    = useState('all')
  const [showUnread,  setShowUnread]  = useState(false)
  const [markingAll,  setMarkingAll]  = useState(false)

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'notifications'),
      where('destinatarioUid', '==', user.uid),
      where('archivada', '==', false),
      orderBy('creadoEn', 'desc'),
      limit(100)
    )
    const unsub = onSnapshot(q, snap => {
      setNotifs(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Notification))
      setLoading(false)
    })
    return unsub
  }, [user])

  const filtered = notifs.filter(n => {
    const matchCat    = category === 'all' || TYPE_CATEGORY[n.tipo] === category
    const matchUnread = !showUnread || !n.leida
    return matchCat && matchUnread
  })

  const unreadCount = notifs.filter(n => !n.leida).length

  async function handleClick(n: Notification) {
    if (!n.leida) await markAsRead(n.id)
    if (n.href) router.push(n.href)
  }

  async function handleMarkAllRead() {
    if (!user) return
    setMarkingAll(true)
    await markAllAsRead(user.uid)
    setMarkingAll(false)
  }

  // Group by date
  const grouped: Record<string, Notification[]> = {}
  for (const n of filtered) {
    const d   = toDate(n.creadoEn)
    const key = format(d, "d 'de' MMMM yyyy", { locale: es })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(n)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Notificaciones"
        subtitle={`${unreadCount} sin leer`}
        actions={
          unreadCount > 0 ? (
            <button onClick={handleMarkAllRead} disabled={markingAll}
              className="btn-ghost flex items-center gap-2 text-sm">
              {markingAll ? <Spinner size={14} /> : <CheckCheck size={14} />}
              Marcar todas como leídas
            </button>
          ) : undefined
        }
      />

      <div className="px-4 md:px-8 pb-10 pt-4 space-y-4">

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Category tabs — scrollable */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map(cat => {
              const Icon  = cat.icon
              const count = cat.id === 'all'
                ? notifs.length
                : notifs.filter(n => TYPE_CATEGORY[n.tipo] === cat.id).length
              return (
                <button key={cat.id} onClick={() => setCategory(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap border',
                    category === cat.id
                      ? 'text-[#060910] border-transparent'
                      : 'text-slate-400 border-white/8 hover:text-slate-200'
                  )}
                  style={category === cat.id ? { background: 'linear-gradient(135deg, #00b0ff, #0077cc)' } : {}}>
                  <Icon size={12} />
                  {cat.label}
                  {count > 0 && (
                    <span className={cn('px-1 py-0.5 rounded text-2xs',
                      category === cat.id ? 'bg-black/20' : 'bg-white/10')}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Unread toggle */}
          <button onClick={() => setShowUnread(s => !s)}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border whitespace-nowrap',
              showUnread ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'text-slate-400 border-white/8')}>
            <Bell size={12} /> Solo sin leer
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
              <Inbox size={28} className="text-slate-500" />
            </div>
            <p className="text-slate-400 text-sm">Sin notificaciones</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date}>
                <p className="text-2xs font-medium text-slate-500 uppercase tracking-widest mb-3">{date}</p>
                <div className="space-y-2">
                  {items.map(n => {
                    const cfg = NOTIF_CONFIG[n.tipo]
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={cn(
                          'flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer group',
                          n.leida
                            ? 'border-white/5 hover:border-white/10 opacity-70 hover:opacity-100'
                            : 'border-white/8 bg-white/[0.02] hover:bg-white/[0.04]'
                        )}
                      >
                        {/* Unread indicator */}
                        <div className={cn('w-1 h-1 rounded-full shrink-0 mt-2',
                          n.leida ? 'bg-transparent' : 'bg-blue-400')} />

                        {/* Icon */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ background: `${cfg.color}15`, border: `1px solid ${cfg.color}25` }}>
                          {cfg.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold" style={{ color: cfg.color }}>
                                {cfg.label}
                              </span>
                              <span className={cn('text-2xs px-1.5 py-0.5 rounded font-medium',
                                n.prioridad === 'urgent' ? 'bg-red-500/20 text-red-400' :
                                n.prioridad === 'high'   ? 'bg-amber-500/20 text-amber-400' :
                                n.prioridad === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-slate-500/20 text-slate-400')}>
                                {n.prioridad === 'urgent' ? 'Urgente' :
                                 n.prioridad === 'high'   ? 'Alta' :
                                 n.prioridad === 'medium' ? 'Media' : 'Baja'}
                              </span>
                            </div>
                            <span className="text-2xs text-slate-500 shrink-0">
                              {format(toDate(n.creadoEn), 'HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed">{n.descripcion}</p>
                          {n.href && (
                            <p className="text-2xs text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Clic para ir →
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {!n.leida && (
                            <button onClick={e => { e.stopPropagation(); markAsRead(n.id) }}
                              title="Marcar como leída"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 transition-colors">
                              <CheckCheck size={14} />
                            </button>
                          )}
                          <button onClick={e => { e.stopPropagation(); archiveNotification(n.id) }}
                            title="Archivar"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors">
                            <Archive size={14} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
