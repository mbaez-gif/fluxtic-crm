'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import styles from './Sidebar.module.css';
import { usePermisos } from '@/hooks/usePermisos';
import type { Permiso } from '@/lib/permissions';

type NavItem = {
  href: string
  label: string
  icon: string
  permiso: Permiso
}

type NavSection = {
  label: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    label: 'Operación',
    items: [
      { href: '/admin/dashboard',  label: 'Dashboard',      icon: 'dashboard', permiso: '*' },
      { href: '/admin/agenda',     label: 'Agenda médica',  icon: 'calendar',  permiso: 'agenda:ver' },
      { href: '/admin/pacientes',  label: 'Pacientes',      icon: 'users',     permiso: 'paciente:ver' },
    ],
  },
  {
    label: 'Clínica',
    items: [
      { href: '/admin/historia-clinica', label: 'Historia clínica', icon: 'medical',  permiso: 'hc:ver' },
      { href: '/admin/profesionales',    label: 'Profesionales',    icon: 'stethoscope', permiso: 'profesional:ver' },
      { href: '/admin/prestaciones',     label: 'Prestaciones',     icon: 'syringe',  permiso: 'prestacion:ver' },
      { href: '/admin/especialidades',   label: 'Especialidades',   icon: 'tag',      permiso: 'especialidad:ver' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { href: '/admin/facturacion',   label: 'Facturación',    icon: 'receipt', permiso: 'comprobante:ver' },
      { href: '/admin/coberturas',    label: 'Obras sociales', icon: 'shield',  permiso: 'cobertura:ver' },
      { href: '/admin/insumos',       label: 'Insumos',        icon: 'box',     permiso: '*' },
      { href: '/admin/comunicaciones',label: 'Comunicaciones', icon: 'chat',    permiso: 'comunicacion:ver' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/admin/reportes',       label: 'Reportes',       icon: 'chart', permiso: 'reporte:ver' },
      { href: '/admin/auditoria',      label: 'Auditoría',      icon: 'audit', permiso: 'auditoria:ver' },
      { href: '/admin/sedes',          label: 'Sedes',          icon: 'building', permiso: 'sede:ver' },
      { href: '/admin/configuracion',  label: 'Configuración',  icon: 'gear',  permiso: '*' },
    ],
  },
]

const ICONS: Record<string, React.ReactNode> = {
  dashboard:    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  calendar:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  users:        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  medical:      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>,
  stethoscope:  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>,
  syringe:      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/></svg>,
  tag:          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  receipt:      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 2 2 2-2 2 2 2-2 3 2V4a2 2 0 0 0-2-2z"/><path d="M8 10h8M8 14h5"/></svg>,
  shield:       <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  box:          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  chat:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  chart:        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  audit:        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
  building:     <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="6" x2="9" y2="6"/><line x1="15" y1="6" x2="15" y2="6"/><line x1="9" y1="10" x2="9" y2="10"/><line x1="15" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="9" y2="14"/><line x1="15" y1="14" x2="15" y2="14"/></svg>,
  gear:         <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  logout:       <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const permisos = usePermisos();

  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    if (href === '/admin/dashboard') return pathname === '/admin/dashboard';
    return pathname?.startsWith(href) ?? false;
  }

  const nombre  = session?.user?.name ?? 'Fluxtic Salud';
  const inicial = nombre[0].toUpperCase();
  const rol     = (((session?.user as any)?.rol ?? 'admin') as string).toLowerCase().replace('_', ' ');

  return (
    <>
      {open && <div className={styles.overlay} onClick={onClose} />}

      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.inner}>

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

          <nav className={styles.nav}>
            {NAV.map(section => {
              const visibles = section.items.filter(item =>
                item.permiso === '*' || permisos.hasFlexible(item.permiso)
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
