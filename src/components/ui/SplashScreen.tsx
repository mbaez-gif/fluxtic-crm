'use client'

import { useEffect, useState } from 'react'
import { FluxticLogo }         from '@/components/ui/FluxticLogo'

interface Props {
  onDone: () => void
}

export function SplashScreen({ onDone }: Props) {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter')

  useEffect(() => {
    // Phase timeline
    const t1 = setTimeout(() => setPhase('show'), 100)   // start showing
    const t2 = setTimeout(() => setPhase('exit'), 2200)  // start fading
    const t3 = setTimeout(() => onDone(),         2800)  // done

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background:   'linear-gradient(135deg, #060910 0%, #0d1829 40%, #0a1520 100%)',
        opacity:      phase === 'exit' ? 0 : 1,
        transition:   'opacity 0.6s ease-in-out',
      }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:  'linear-gradient(#00b0ff 1px, transparent 1px), linear-gradient(90deg, #00b0ff 1px, transparent 1px)',
          backgroundSize:   '60px 60px',
        }}
      />

      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="rounded-full"
          style={{
            width:      '600px',
            height:     '600px',
            background: 'radial-gradient(circle, rgba(0,176,255,0.12) 0%, transparent 70%)',
            transform:  phase === 'show' ? 'scale(1)' : 'scale(0.3)',
            transition: 'transform 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />
      </div>

      {/* Main content */}
      <div
        style={{
          opacity:    phase === 'enter' ? 0 : 1,
          transform:  phase === 'enter' ? 'translateY(30px) scale(0.9)' : 'translateY(0) scale(1)',
          transition: 'opacity 0.8s ease-out, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        className="flex flex-col items-center gap-6 relative z-10"
      >
        {/* Logo */}
        <div className="relative">
          {/* Outer ring */}
          <div
            className="absolute inset-0 rounded-full border-2 border-blue-400/30"
            style={{
              transform:  phase === 'show' ? 'scale(2.2)' : 'scale(1)',
              opacity:    phase === 'show' ? 0 : 0.6,
              transition: 'transform 2s ease-out, opacity 2s ease-out',
            }}
          />
          {/* Middle ring */}
          <div
            className="absolute inset-0 rounded-full border border-blue-400/20"
            style={{
              transform:  phase === 'show' ? 'scale(1.8)' : 'scale(1)',
              opacity:    phase === 'show' ? 0 : 0.4,
              transition: 'transform 2s ease-out 0.2s, opacity 2s ease-out 0.2s',
            }}
          />

          <div
            className="relative"
            style={{
              filter: 'drop-shadow(0 0 30px rgba(0, 176, 255, 0.5))',
            }}
          >
            {/* Use the actual logo image */}
            <img
              src="/fluxtic-logo.jpg"
              alt="Fluxtic"
              className="rounded-2xl"
              style={{
                width:  160,
                height: 160,
                objectFit: 'contain',
                background: 'white',
                padding: '12px',
              }}
            />
          </div>
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h1
            className="font-black uppercase tracking-[0.3em]"
            style={{ fontSize: 42, color: '#f1f5f9', letterSpacing: '0.25em' }}
          >
            FLU<span style={{ color: '#00b0ff' }}>X</span>TIC
          </h1>
          <p
            className="uppercase tracking-[0.4em] font-medium"
            style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.35em' }}
          >
            — Automatizaciones Inteligentes —
          </p>
        </div>

        {/* Loading bar */}
        <div
          className="overflow-hidden rounded-full"
          style={{ width: 180, height: 2, background: 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
              background:  'linear-gradient(90deg, #00b0ff, #60cdff)',
              width:       phase === 'show' ? '100%' : '0%',
              transition:  'width 1.8s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow:   '0 0 8px rgba(0,176,255,0.8)',
            }}
          />
        </div>

        {/* Tagline */}
        <p
          style={{
            fontSize:   11,
            color:      '#475569',
            opacity:    phase === 'show' ? 1 : 0,
            transition: 'opacity 0.8s ease 0.5s',
          }}
        >
          CRM · v1.0
        </p>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-8 left-8 w-8 h-8 border-l-2 border-t-2 border-blue-400/30 rounded-tl-lg" />
      <div className="absolute top-8 right-8 w-8 h-8 border-r-2 border-t-2 border-blue-400/30 rounded-tr-lg" />
      <div className="absolute bottom-8 left-8 w-8 h-8 border-l-2 border-b-2 border-blue-400/30 rounded-bl-lg" />
      <div className="absolute bottom-8 right-8 w-8 h-8 border-r-2 border-b-2 border-blue-400/30 rounded-br-lg" />
    </div>
  )
}
