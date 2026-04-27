'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, ChevronDown, Lock } from 'lucide-react'

const TAGLINES = [
  'Automatizamos procesos. Conectamos herramientas. Creamos soluciones.',
  'IA, CRM e integraciones para empresas que quieren trabajar mejor.',
  'Tu negocio, tus datos y tus canales conectados en un solo flujo.',
]

function FloatingNodes() {
  const nodes = [
    { x: '10%', y: '20%', size: 6,  delay: 0,   dur: 4   },
    { x: '85%', y: '15%', size: 8,  delay: 0.5, dur: 5   },
    { x: '20%', y: '75%', size: 5,  delay: 1,   dur: 3.5 },
    { x: '75%', y: '70%', size: 7,  delay: 1.5, dur: 4.5 },
    { x: '50%', y: '10%', size: 4,  delay: 0.8, dur: 3   },
    { x: '90%', y: '50%', size: 5,  delay: 2,   dur: 5   },
    { x: '5%',  y: '50%', size: 6,  delay: 0.3, dur: 4   },
    { x: '60%', y: '85%', size: 4,  delay: 1.2, dur: 3.5 },
  ]
  const connections = [[0,1],[1,4],[2,0],[3,1],[5,3],[6,2],[7,3]]
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="#00b0ff" stopOpacity="0" />
            <stop offset="50%"  stopColor="#00b0ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00b0ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {connections.map(([a,b],i) => (
          <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
            stroke="url(#lineGrad)" strokeWidth="1" opacity="0.5" />
        ))}
        {nodes.map((n,i) => (
          <circle key={i} cx={n.x} cy={n.y} r={n.size} fill="#00b0ff" opacity="0.6">
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur={`${n.dur}s`} begin={`${n.delay}s`} repeatCount="indefinite" />
            <animate attributeName="r" values={`${n.size};${n.size*1.4};${n.size}`} dur={`${n.dur}s`} begin={`${n.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
    </div>
  )
}

function NavBar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background:     scrolled ? 'rgba(6,9,16,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom:   scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
      }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <img src="/fluxtic-logo.jpg" alt="Fluxtic" className="rounded-lg"
            style={{ width: 32, height: 32, objectFit: 'contain', background: 'white', padding: 3 }} />
          <span className="font-black tracking-[0.15em] uppercase text-sm text-white">
            FLU<span style={{ color: '#00b0ff' }}>X</span>TIC
          </span>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {[
            ['#soluciones',      'Soluciones'],
            ['#como-trabajamos', 'Cómo trabajamos'],
            ['#crm',             'CRM'],
            ['#contacto',        'Contacto'],
          ].map(([href, label]) => (
            <a key={href} href={href}
              className="text-sm text-slate-400 hover:text-white transition-colors">
              {label}
            </a>
          ))}

          {/* Divider */}
          <div className="w-px h-4 bg-white/10" />

          {/* CRM Access — visible but subtle */}
          <a href="/auth/login"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            title="Acceso al panel interno">
            <Lock size={11} /> Acceso equipo
          </a>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* CRM access on mobile */}
          <a href="/auth/login"
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors md:hidden px-2 py-1.5"
            title="Ingresar al CRM">
            <Lock size={12} />
          </a>
          {/* Main CTA */}
          <a href="#contacto"
            className="text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #00b0ff, #0077cc)', color: '#060910' }}>
            Contactar
          </a>
        </div>
      </div>
    </nav>
  )
}

export function Hero() {
  const [taglineIdx, setTaglineIdx] = useState(0)
  const [visible,    setVisible]    = useState(true)
  const [entered,    setEntered]    = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const cycle = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setTaglineIdx(i => (i + 1) % TAGLINES.length); setVisible(true) }, 400)
    }, 3500)
    return () => clearInterval(cycle)
  }, [])

  return (
    <>
      <NavBar />
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,176,255,0.08) 0%, transparent 70%)',
        }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(#00b0ff 1px, transparent 1px), linear-gradient(90deg, #00b0ff 1px, transparent 1px)',
          backgroundSize:  '60px 60px',
        }} />
        <FloatingNodes />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">

          <div className="flex justify-center mb-8" style={{
            opacity:    entered ? 1 : 0,
            transform:  entered ? 'scale(1) translateY(0)' : 'scale(0.7) translateY(20px)',
            transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl" style={{
                background: 'radial-gradient(circle, rgba(0,176,255,0.4) 0%, transparent 70%)',
                filter: 'blur(20px)', transform: 'scale(1.4)',
              }} />
              <img src="/fluxtic-logo.jpg" alt="Fluxtic" className="relative rounded-2xl"
                style={{ width: 80, height: 80, objectFit: 'contain', background: 'white', padding: '8px',
                  boxShadow: '0 0 40px rgba(0,176,255,0.3)' }} />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium mb-6"
            style={{
              background: 'rgba(0,176,255,0.08)', borderColor: 'rgba(0,176,255,0.2)', color: '#00b0ff',
              opacity: entered ? 1 : 0, transform: entered ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s',
            }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Automatizaciones Inteligentes
          </div>

          <h1 className="font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-6 leading-[1.05]"
            style={{
              color: '#f1f5f9', opacity: entered ? 1 : 0,
              transform: entered ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.7s ease 0.3s, transform 0.7s ease 0.3s',
            }}>
            Conectamos tu empresa<br />
            <span style={{ background: 'linear-gradient(135deg, #00b0ff, #60cdff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              con el futuro
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed"
            style={{
              opacity:    (entered && visible) ? 1 : 0,
              transform:  (entered && visible) ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
            }}>
            {TAGLINES[taglineIdx]}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4"
            style={{
              opacity: entered ? 1 : 0, transform: entered ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.7s ease 0.5s, transform 0.7s ease 0.5s',
            }}>
            <a href="#contacto"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #00b0ff, #0077cc)', color: '#060910',
                boxShadow: '0 4px 24px rgba(0,176,255,0.35)' }}>
              Solicitar diagnóstico <ArrowRight size={16} />
            </a>
            <a href="#soluciones"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm border transition-all hover:border-blue-400/50 hover:text-white"
              style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#94a3b8' }}>
              Ver soluciones
            </a>
          </div>

          <div className="mt-16 flex justify-center"
            style={{ opacity: entered ? 0.4 : 0, transition: 'opacity 1s ease 1s' }}>
            <a href="#servicios" className="flex flex-col items-center gap-2 text-slate-500 hover:text-slate-300 transition-colors">
              <span className="text-2xs uppercase tracking-widest">Scroll</span>
              <ChevronDown size={16} className="animate-bounce" />
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
