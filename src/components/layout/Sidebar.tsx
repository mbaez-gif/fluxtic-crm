'use client'

import Link              from 'next/link'
import { usePathname }   from 'next/navigation'
import { signOut }       from '@/lib/firebase/auth'
import { useRouter }     from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { cn }            from '@/lib/utils'
import {
  LayoutDashboard, Users, Stethoscope, TrendingUp,
  Building2, FolderKanban, CreditCard,
  CheckSquare, LogOut, Plug, Calculator,
  TrendingDown, Store, Tag, Wallet, Lock,
  MessageCircle, Receipt, FileText, Server, Boxes,
} from 'lucide-react'

const CRM_NAV = [
  { href: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/leads',         label: 'Leads',          icon: Users           },
  { href: '/diagnosticos',  label: 'Diagnósticos',   icon: Stethoscope     },
  { href: '/oportunidades', label: 'Pipeline',        icon: TrendingUp      },
  { href: '/presupuestos',  label: 'Presupuestos',   icon: Receipt         },
  { href: '/clientes',      label: 'Clientes',       icon: Building2       },
  { href: '/proyectos',     label: 'Proyectos',      icon: FolderKanban    },
  { href: '/abonos',        label: 'Abonos',         icon: CreditCard      },
  { href: '/tareas',        label: 'Tareas',         icon: CheckSquare     },
  { href: '/whatsapp',      label: 'WhatsApp',       icon: MessageCircle   },
  { href: '/integraciones', label: 'Integraciones',  icon: Plug            },
]

const ADMIN_NAV = [
  { href: '/admin',              label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/admin/gastos',       label: 'Gastos',         icon: TrendingDown    },
  { href: '/admin/proveedores',  label: 'Proveedores',    icon: Store           },
  { href: '/admin/categorias',   label: 'Categorías',     icon: Tag             },
  { href: '/admin/medios-pago',  label: 'Medios de pago', icon: Wallet          },
  { href: '/admin/cierre',       label: 'Cierre mensual', icon: Lock            },
]

// Plataforma: sólo visible para super_admin
const PLATFORM_NAV = [
  { href: '/plataforma/clientes',       label: 'Clientes Fluxtic', icon: Boxes  },
  { href: '/plataforma/clientes/nuevo', label: 'Nuevo cliente',    icon: Server },
]

interface Props { onNavigate?: () => void }

function NavItem({ href, label, icon: Icon, active, onClick }: {
  href: string; label: string; icon: any; active: boolean; onClick?: () => void
}) {
  return (
    <Link href={href} onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
        active ? 'font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
      )}
      style={active ? { background: 'rgba(0,176,255,0.12)', color: '#00b0ff' } : {}}>
      <Icon size={16} strokeWidth={active ? 2 : 1.75}
        style={{ color: active ? '#00b0ff' : undefined }} />
      {label}
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: '#00b0ff' }} />}
    </Link>
  )
}

export function Sidebar({ onNavigate }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const { profile } = useAuthContext()
  const isAdmin    = pathname.startsWith('/admin')
  const isPlatform = pathname.startsWith('/plataforma')
  const isSuper    = profile?.rol === 'super_admin'

  async function handleSignOut() {
    await signOut()
    router.replace('/auth/login')
  }

  return (
    <div className="flex flex-col h-full w-full" style={{ background: '#080d18' }}>

      {/* Logo */}
      <div className="hidden md:flex items-center gap-3 px-4 h-16 border-b border-white/5">
        <img src="/fluxtic-logo.jpg" alt="FluxTIC" className="rounded-lg"
          style={{ width: 32, height: 32, objectFit: 'contain', background: 'white', padding: 3 }} />
        <div>
          <p className="font-black tracking-[0.15em] uppercase text-sm text-slate-100">
            FLU<span style={{ color: '#00b0ff' }}>X</span>TIC
          </p>
          <p className="text-slate-500 tracking-widest uppercase" style={{ fontSize: 8 }}>CRM</p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className={cn('flex p-2 gap-1 border-b border-white/5', isSuper && 'flex-wrap')}>
        <Link href="/dashboard" onClick={onNavigate}
          className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
            !isAdmin && !isPlatform ? 'text-[#060910] font-bold' : 'text-slate-400 hover:text-slate-200')}
          style={!isAdmin && !isPlatform ? { background: 'linear-gradient(135deg, #00b0ff, #0077cc)' } : {}}>
          <FolderKanban size={12} /> CRM
        </Link>
        <Link href="/admin" onClick={onNavigate}
          className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
            isAdmin ? 'text-[#060910] font-bold' : 'text-slate-400 hover:text-slate-200')}
          style={isAdmin ? { background: 'linear-gradient(135deg, #00b0ff, #0077cc)' } : {}}>
          <Calculator size={12} /> Admin
        </Link>
        {isSuper && (
          <Link href="/plataforma/clientes" onClick={onNavigate}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all',
              isPlatform ? 'text-[#060910] font-bold' : 'text-slate-400 hover:text-slate-200')}
            style={isPlatform ? { background: 'linear-gradient(135deg, #00b0ff, #0077cc)' } : {}}>
            <Server size={12} /> Plataforma
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {isPlatform && isSuper ? (
          <>
            <p className="text-2xs font-medium text-slate-500 uppercase tracking-widest px-3 pb-1 pt-1">
              Plataforma Fluxtic
            </p>
            {PLATFORM_NAV.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} onClick={onNavigate}
                active={pathname === href || pathname.startsWith(href + '/')} />
            ))}
          </>
        ) : isAdmin ? (
          <>
            <p className="text-2xs font-medium text-slate-500 uppercase tracking-widest px-3 pb-1 pt-1">Admin</p>
            {ADMIN_NAV.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon} onClick={onNavigate}
                active={pathname === href || (href !== '/admin' && pathname.startsWith(href + '/'))} />
            ))}
          </>
        ) : (
          CRM_NAV.map(({ href, label, icon }) => (
            <NavItem key={href} href={href} label={label} icon={icon} onClick={onNavigate}
              active={pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))} />
          ))
        )}
      </nav>

      {/* User */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'linear-gradient(135deg, #00b0ff, #0077cc)', color: '#060910' }}>
            {profile?.nombre?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{profile?.nombre ?? 'Usuario'}</p>
            <p className="text-2xs text-slate-500 truncate capitalize">{profile?.rol ?? '—'}</p>
          </div>
          <button onClick={handleSignOut} title="Cerrar sesión"
            className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
