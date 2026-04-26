'use client'

import Link              from 'next/link'
import { usePathname }   from 'next/navigation'
import { signOut }       from '@/lib/firebase/auth'
import { useRouter }     from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { cn }            from '@/lib/utils'
import {
  LayoutDashboard, Users, Stethoscope, TrendingUp,
  FileText, Building2, FolderKanban, CreditCard,
  CheckSquare, LogOut, Plug, Calculator,
  TrendingDown, Store, Tag, Wallet, Lock,
  MessageCircle,
} from 'lucide-react'

const CRM_NAV = [
  { href: '/dashboard',     label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/leads',         label: 'Leads',          icon: Users           },
  { href: '/diagnosticos',  label: 'Diagnósticos',   icon: Stethoscope     },
  { href: '/oportunidades', label: 'Pipeline',        icon: TrendingUp      },
  { href: '/propuestas',    label: 'Propuestas',     icon: FileText        },
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

function NavItem({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: any; active: boolean
}) {
  return (
    <Link href={href} className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
      active
        ? 'bg-[rgba(0,176,255,0.12)] text-[#00b0ff] font-medium'
        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
    )}>
      <Icon size={16} strokeWidth={active ? 2 : 1.75}
        className={active ? 'text-[#00b0ff]' : 'text-slate-500'} />
      {label}
      {active && <span className="ml-auto w-1 h-1 rounded-full bg-[#00b0ff]" />}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { profile } = useAuthContext()
  const isAdmin  = pathname.startsWith('/admin')

  async function handleSignOut() {
    await signOut()
    router.replace('/auth/login')
  }

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-[#080d18] border-r border-white/5 shrink-0">

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/5">
        <img
          src="/fluxtic-logo.jpg"
          alt="Fluxtic"
          className="rounded-lg object-contain bg-white"
          style={{ width: 32, height: 32, padding: 3 }}
        />
        <div>
          <p className="font-black tracking-[0.15em] uppercase text-sm text-slate-100">
            FLU<span style={{ color: '#00b0ff' }}>X</span>TIC
          </p>
          <p className="text-2xs text-slate-500 tracking-widest uppercase" style={{ fontSize: 8 }}>
            CRM
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex p-2 gap-1 border-b border-white/5">
        <Link href="/dashboard"
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
            !isAdmin
              ? 'text-[#060910] font-bold'
              : 'text-slate-400 hover:text-slate-200'
          )}
          style={!isAdmin ? { background: 'linear-gradient(135deg, #00b0ff, #0077cc)' } : {}}>
          <FolderKanban size={12} /> CRM
        </Link>
        <Link href="/admin"
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
            isAdmin
              ? 'text-[#060910] font-bold'
              : 'text-slate-400 hover:text-slate-200'
          )}
          style={isAdmin ? { background: 'linear-gradient(135deg, #00b0ff, #0077cc)' } : {}}>
          <Calculator size={12} /> Admin
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {!isAdmin ? (
          CRM_NAV.map(({ href, label, icon }) => (
            <NavItem key={href} href={href} label={label} icon={icon}
              active={pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'))} />
          ))
        ) : (
          <>
            <p className="text-2xs font-medium text-slate-500 uppercase tracking-widest px-3 pb-1">Admin</p>
            {ADMIN_NAV.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon}
                active={pathname === href || (href !== '/admin' && pathname.startsWith(href + '/'))} />
            ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-2xs font-bold shrink-0"
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
    </aside>
  )
}
