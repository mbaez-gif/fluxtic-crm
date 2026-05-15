import type { ReactNode } from 'react'
import styles from './layout.module.css'

export const metadata = {
  title: 'Delfina Paz · Reservá tu turno',
  description: 'Reservá online tu turno en Delfina Paz Beauty. Estética profesional con atención personalizada.',
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            Delfina <em>Paz</em>
          </div>
          <nav className={styles.headerNav}>
            <a href="#servicios">Servicios</a>
            <a href="#sobre">Sobre nosotros</a>
            <a href="#reservar">Reservar</a>
            <a href="#contacto">Contacto</a>
          </nav>
        </div>
      </header>

      <main className={styles.main}>{children}</main>

      <footer className={styles.footer} id="contacto">
        <div className={styles.footerInner}>
          <div>
            <div className={styles.footerBrand}>Delfina Paz Beauty</div>
            <p style={{ fontSize: 14, color: 'var(--soft-ink)', lineHeight: 1.6, margin: 0, maxWidth: 360 }}>
              Espacio de belleza y bienestar. Atención personalizada, productos premium
              y la mejor experiencia para vos.
            </p>
          </div>
          <div className={styles.footerCol}>
            <h4>Visitanos</h4>
            <p>Av. Principal 1234</p>
            <p>CABA, Argentina</p>
            <p>Lun-Sáb · 9:00 a 20:00</p>
          </div>
          <div className={styles.footerCol}>
            <h4>Seguinos</h4>
            <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram @delfinapaz</a>
            <a href="https://wa.me/" target="_blank" rel="noreferrer">WhatsApp</a>
            <a href="mailto:hola@delfinapaz.com">hola@delfinapaz.com</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          © {new Date().getFullYear()} Delfina Paz Beauty · Todos los derechos reservados
        </div>
      </footer>
    </div>
  )
}
