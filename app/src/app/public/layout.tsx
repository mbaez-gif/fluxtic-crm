import type { ReactNode } from 'react'
import styles from './layout.module.css'

export const metadata = {
  title: 'Fluxtic Salud · Reservá tu turno',
  description: 'Reservá online tu consulta médica. Atención profesional con turnos confirmados.',
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            Fluxtic <em>Salud</em>
          </div>
          <nav className={styles.headerNav}>
            <a href="#prestaciones">Prestaciones</a>
            <a href="#sobre">Sobre nosotros</a>
            <a href="#reservar">Reservar turno</a>
            <a href="#contacto">Contacto</a>
          </nav>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer} id="contacto">
        <div className={styles.footerInner}>
          <div>
            <div className={styles.footerBrand}>Fluxtic Salud</div>
            <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, margin: 0, maxWidth: 360 }}>
              Centro médico con atención profesional, turnos online y seguimiento de pacientes.
            </p>
          </div>
          <div className={styles.footerCol}>
            <h4>Visitanos</h4>
            <p>Dirección de la clínica</p>
            <p>Ciudad, Argentina</p>
            <p>Lun-Vie · 8:00 a 20:00</p>
          </div>
          <div className={styles.footerCol}>
            <h4>Contacto</h4>
            <a href="https://wa.me/" target="_blank" rel="noreferrer">WhatsApp</a>
            <a href="mailto:contacto@clinica.com">contacto@clinica.com</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          © {new Date().getFullYear()} Fluxtic Salud · Todos los derechos reservados
        </div>
      </footer>
    </div>
  )
}
