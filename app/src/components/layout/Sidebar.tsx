'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import styles from './Sidebar.module.css';
import { usePermisos } from '@/hooks/usePermisos';
import type { Permisos } from '@/types/usuarios';

type NavItem = {
  href: string
  label: string
  icon: string
  permiso?: keyof Permisos
}

type NavSection = {
  label: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { href: '/admin/dashboard',      label: 'Dashboard',      icon: 'dashboard', permiso: 'puede_ver_reportes'     },
      { href: '/admin/turnos',         label: 'Turnos',         icon: 'calendar',  permiso: 'puede_gestionar_turnos' },
      { href: '/admin/turnos/tablero', label: 'Tablero kanban', icon: 'kanban',    permiso: 'puede_gestionar_turnos' },
      { href: '/admin/clientes',       label: 'Clientes',       icon: 'users',     permiso: 'puede_gestionar_clientes' },
    ],
  },
  {
    label: 'Operación',
    items: [
      { href: '/admin/caja',                          label: 'Caja / POS',       icon: 'card',    permiso: 'puede_ver_caja'                },
      { href: '/admin/configuracion/comprobantes',    label: 'Señas recibidas',  icon: 'sena',    permiso: 'puede_reimprimir_comprobantes'  },
      { href: '/admin/ventas',                        label: 'Ventas',           icon: 'receipt', permiso: 'puede_ver_ventas_dia'          },
      { href: '/admin/stock',                         label: 'Stock',            icon: 'box',     permiso: 'puede_gestionar_productos'     },
      { href: '/admin/servicios',                     label: 'Servicios',        icon: 'star',    permiso: 'puede_gestionar_servicios'     },
      { href: '/admin/productos',                     label: 'Productos',        icon: 'shop',    permiso: 'puede_gestionar_productos'     },
    ],
  },
  {
    label: 'Canales',
    items: [
      { href: '/admin/instagram',   label: 'Instagram',   icon: 'instagram', permiso: 'puede_gestionar_integraciones' },
      { href: '/admin/tiendanube',  label: 'Tienda Nube', icon: 'cart',      permiso: 'puede_gestionar_integraciones' },
      { href: '/admin/whatsapp',    label: 'WhatsApp',    icon: 'chat',      permiso: 'puede_gestionar_integraciones' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin/automatizaciones', label: 'Automatizaciones', icon: 'auto',  permiso: 'puede_gestionar_integraciones' },
      { href: '/admin/reportes',         label: 'Reportes',         icon: 'chart', permiso: 'puede_ver_reportes'            },
      { href: '/admin/configuracion',    label: 'Configuración',    icon: 'gear',  permiso: 'puede_gestionar_configuracion' },
    ],
  },
]

const ICONS: Record<string, React.ReactNode> = {
  dashboard:    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  calendar:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  users:        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  card:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  box:          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  star:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  shop:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  instagram:    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
  cart:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  chat:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  auto:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v3m0 0-5 7m5-7 5 7"/></svg>,
  chart:        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  gear:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  kanban:       <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="5" height="15" rx="1"/></svg>,
  receipt:      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 2 2 2-2 2 2 2-2 3 2V4a2 2 0 0 0-2-2z"/><path d="M8 10h8M8 14h5"/></svg>,
  sena:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></svg>,
  logout:       <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  scissors:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  'person-check': <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>,
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const permisos = usePermisos();

  // Cerrar al navegar en mobile
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    if (href === '/admin/turnos') return pathname === '/admin/turnos' || (pathname.startsWith('/admin/turnos') && !pathname.startsWith('/admin/turnos/tablero'));
    if (href === '/admin/dashboard') return pathname === '/admin/dashboard';
    return pathname.startsWith(href);
  }

  const nombre  = session?.user?.name ?? 'Fluxtic Salud';
  const inicial = nombre[0].toUpperCase();
  const rol     = ((session?.user as any)?.rol ?? 'admin').toLowerCase();

  return (
    <>
      {/* Overlay mobile */}
      {open && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.inner}>

          {/* Logo */}
          <div className={styles.logoArea}>
            <div className={styles.logoMark}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="3" width="6" height="18" rx="1.5" />
                <rect x="3" y="9" width="18" height="6" rx="1.5" />
              </svg>
              Fluxtic <em>Salud</em>
            </div>
            <div className={styles.logoTag}>CRM Clínico · v0.1</div>
          </div>

          {/* Nav */}
          <nav className={styles.nav}>
            {NAV.map(section => {
              const visibles = section.items.filter(item =>
                !item.permiso || permisos[item.permiso]
              );
              if (visibles.length === 0) return null;
              return (
                <div key={section.label} className={styles.navSection}>
                  <div className={styles.navSectionLabel}>{section.label}</div>
                  {visibles.map(item => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`${styles.navItem} ${isActive(item.href) ? styles.active : ''}`}
                    >
                      <span className={styles.navIcon}>{ICONS[item.icon]}</span>
                      {item.label}
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>

          {/* Bottom: usuario + logout */}
          <div className={styles.sidebarBottom}>
            <div className={styles.userRow}>
              <div className={styles.userAv}>{inicial}</div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{nombre}</div>
                <div className={styles.userRole}>{rol}</div>
              </div>
              <button
                className={styles.logoutBtn}
                onClick={() => signOut({ callbackUrl: '/login' })}
                title="Cerrar sesión"
              >
                {ICONS.logout}
              </button>
            </div>
          </div>

        </div>
      </aside>
    </>
  );
}
