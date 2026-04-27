'use client'

import { Lock } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t py-12 px-4 sm:px-6"
      style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img src="/fluxtic-logo.jpg" alt="Fluxtic" className="rounded-lg"
                style={{ width: 32, height: 32, objectFit: 'contain', background: 'white', padding: 3 }} />
              <span className="font-black tracking-[0.15em] uppercase text-sm text-white">
                FLU<span style={{ color: '#00b0ff' }}>X</span>TIC
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-xs">
              Automatizaciones inteligentes para empresas que quieren crecer sin perder tiempo en procesos manuales.
            </p>
          </div>

          {/* Nav links */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Navegación</p>
            <div className="space-y-2">
              {[
                ['#servicios',       'Servicios'],
                ['#soluciones',      'Soluciones'],
                ['#como-trabajamos', 'Cómo trabajamos'],
                ['#crm',             'CRM Fluxtic'],
                ['#contacto',        'Contacto'],
              ].map(([href, label]) => (
                <a key={href} href={href}
                  className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Contact + CRM access */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Contacto</p>
            <a href="mailto:contacto@fluxtic.com"
              className="text-sm font-medium transition-colors hover:text-white block mb-1"
              style={{ color: '#00b0ff' }}>
              contacto@fluxtic.com
            </a>
            <p className="text-xs text-slate-500 mb-6">Respondemos en menos de 24 horas hábiles.</p>

            {/* CRM Access — separated visually */}
            <div className="pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <p className="text-2xs font-bold uppercase tracking-widest text-slate-600 mb-2">Equipo interno</p>
              <a href="/auth/login"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 transition-all border border-white/5 hover:border-white/10"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Lock size={11} /> Acceder al CRM
              </a>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Fluxtic. Todos los derechos reservados.
          </p>
          <p className="text-xs text-slate-600">Automatizaciones Inteligentes</p>
        </div>
      </div>
    </footer>
  )
}
