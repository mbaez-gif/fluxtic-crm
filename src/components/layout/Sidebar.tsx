'use client'

import Link           from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut }     from '@/lib/firebase/auth'
import { useRouter }   from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { cn }          from '@/lib/utils'
import {
  LayoutDashboard, Users, Stethoscope, TrendingUp,
  FileText, Building2, FolderKanban, CreditCard,
  CheckSquare, LogOut, Zap, Plug, Calculator,
  TrendingDown, Store, Tag, Wallet, Lock,
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
  { href: '/integraciones', label: 'Integraciones',  icon: Plug            },
]

const ADMIN_NAV = [
  { href: '/admin',              label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/admin/gastos',       label: 'Gastos',          icon: TrendingDown    },
  { href: '/admin/proveedores',  label: 'Proveedores',     icon: Store           },
  { href: '/admin/categorias',   label: 'Categorías',      icon: Tag             },
  { href: '/admin/medios-pago',  label: 'Medios de pago',  icon: Wallet          },
  { href: '/admin/cierre',       label: 'Cierre mensual',  icon: Lock            },
]

function NavItem({ href, label, icon: Icon, active }: {
  href: string; label: string; icon: any; active: boolean
}) {
  return (
    <Link href={href} className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
      active
        ? 'bg-flux-tealGlow text-flux-teal font-medium'
        : 'text-flux-text3 hover:text-flux-text1 hover:bg-flux-muted'
    )}>
      <Icon size={16} strokeWidth={active ? 2 : 1.75}
        className={active ? 'text-flux-teal' : 'text-flux-text3'} />
      {label}
      {active && <span className="ml-auto w-1 h-1 rounded-full bg-flux-teal" />}
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
    <aside className="flex flex-col w-56 min-h-screen bg-flux-surface border-r border-flux-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-flux-border">
        <div className="w-7 h-7 rounded-lg bg-flux-teal flex items-center justify-center shadow-teal-sm">
          <Zap size={14} className="text-flux-bg" strokeWidth={2.5} />
        </div>
        <span className="font-display font-bold text-base text-flux-white tracking-tight">Fluxtic</span>
      </div>

      {/* Mode toggle */}
      <div className="flex p-2 gap-1 border-b border-flux-border">
        <Link href="/dashboard"
          className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
            !isAdmin ? 'bg-flux-teal text-flux-bg' : 'text-flux-text3 hover:text-flux-text1')}>
          <FolderKanban size={12} /> CRM
        </Link>
        <Link href="/admin"
          className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all',
            isAdmin ? 'bg-flux-teal text-flux-bg' : 'text-flux-text3 hover:text-flux-text1')}>
          <Calculator size={12} /> Admin
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {!isAdmin ? (
          CRM_NAV.map(({ href, label, icon }) => (
            <NavItem key={href} href={href} label={label} icon={icon}
              active={pathname === href || pathname.startsWith(href + '/')} />
          ))
        ) : (
          <>
            <p className="text-2xs font-medium text-flux-text3 uppercase tracking-widest px-3 pb-1">Administración</p>
            {ADMIN_NAV.map(({ href, label, icon }) => (
              <NavItem key={href} href={href} label={label} icon={icon}
                active={pathname === href || (href !== '/admin' && pathname.startsWith(href + '/'))} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-flux-border p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-flux-muted flex items-center justify-center text-2xs font-medium text-flux-teal shrink-0">
            {profile?.nombre?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-flux-text1 truncate">{profile?.nombre ?? 'Usuario'}</p>
            <p className="text-2xs text-flux-text3 truncate capitalize">{profile?.rol ?? '—'}</p>
          </div>
          <button onClick={handleSignOut} title="Cerrar sesión"
            className="text-flux-text3 hover:text-flux-danger transition-colors p-1 rounded">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
