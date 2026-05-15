import type { ReactNode } from 'react'
import Link from 'next/link'

export const metadata = {
  title: 'Portal del paciente · Fluxtic Salud',
  description: 'Tu información clínica, turnos y pagos',
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Link href="/portal/turnos" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--noir)', fontWeight: 600, fontSize: 16 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="18" rx="1.5" />
            <rect x="3" y="9" width="18" height="6" rx="1.5" />
          </svg>
          Fluxtic Salud
        </Link>
        <nav style={{ display: 'flex', gap: 20, fontSize: 13 }}>
          <Link href="/portal/turnos">Turnos</Link>
          <Link href="/portal/historia">Mi historia</Link>
          <Link href="/portal/documentos">Documentos</Link>
          <Link href="/portal/pagos">Pagos</Link>
        </nav>
      </header>
      <main style={{ flex: 1, maxWidth: 960, margin: '0 auto', width: '100%', padding: '24px 16px' }}>
        {children}
      </main>
      <footer style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
        © {new Date().getFullYear()} Fluxtic Salud · Portal del paciente
      </footer>
    </div>
  )
}
