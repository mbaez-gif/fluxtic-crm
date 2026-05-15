'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin/dashboard',               label: 'General'       },
  { href: '/admin/dashboard/servicios',     label: 'Servicios'     },
  { href: '/admin/dashboard/profesionales', label: 'Profesionales' },
]

export default function DashboardTabs() {
  const pathname = usePathname()

  return (
    <div style={{
      display: 'flex', gap: 2, background: 'var(--bg-2)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      padding: 3,
    }}>
      {TABS.map(tab => {
        const active = tab.href === '/admin/dashboard'
          ? pathname === '/admin/dashboard'
          : pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              padding: '5px 16px',
              borderRadius: 'var(--r-sm)',
              fontSize: 12.5,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--noir)' : 'var(--muted)',
              background: active ? 'var(--surface)' : 'transparent',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              textDecoration: 'none',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
