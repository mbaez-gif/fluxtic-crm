'use client'

import { useState, useEffect } from 'react'
import { useRouter }      from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { Sidebar }        from '@/components/layout/Sidebar'
import { SplashScreen }   from '@/components/ui/SplashScreen'
import { Menu, X }        from 'lucide-react'

interface Props { children: React.ReactNode }

const SPLASH_KEY = 'fluxtic_splash_shown'

export function AppShell({ children }: Props) {
  const { user, loading, initialized } = useAuthContext()
  const router = useRouter()
  const [showSplash,   setShowSplash]   = useState(false)
  const [mobileOpen,   setMobileOpen]   = useState(false)

  useEffect(() => {
    const shown = sessionStorage.getItem(SPLASH_KEY)
    if (!shown) { setShowSplash(true); sessionStorage.setItem(SPLASH_KEY, '1') }
  }, [])

  useEffect(() => {
    if (initialized && !loading && !user) router.replace('/auth/login')
  }, [user, loading, initialized, router])

  // Close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [])

  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#060910' }}>
        <img src="/fluxtic-logo.jpg" alt="Fluxtic" className="rounded-xl animate-pulse"
          style={{ width: 56, height: 56, objectFit: 'contain', background: 'white', padding: 6 }} />
      </div>
    )
  }

  if (!user) return null

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}

      <div className="flex min-h-screen bg-flux-bg" style={{ opacity: showSplash ? 0 : 1, transition: 'opacity 0.3s' }}>

        {/* Desktop sidebar — hidden on mobile */}
        <div className="hidden md:flex md:flex-col md:w-56 md:shrink-0">
          <Sidebar onNavigate={() => {}} />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 w-64 md:hidden flex flex-col"
              style={{ background: '#080d18', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between px-4 h-14 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <img src="/fluxtic-logo.jpg" alt="Fluxtic" className="rounded-lg"
                    style={{ width: 28, height: 28, objectFit: 'contain', background: 'white', padding: 3 }} />
                  <span className="font-black tracking-[0.15em] uppercase text-sm text-slate-100">
                    FLU<span style={{ color: '#00b0ff' }}>X</span>TIC
                  </span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </div>
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Mobile top bar */}
          <div className="flex items-center gap-3 px-4 h-14 border-b border-white/5 md:hidden shrink-0"
            style={{ background: '#080d18' }}>
            <button onClick={() => setMobileOpen(true)}
              className="text-slate-400 hover:text-white transition-colors p-1">
              <Menu size={22} />
            </button>
            <img src="/fluxtic-logo.jpg" alt="Fluxtic" className="rounded-lg"
              style={{ width: 28, height: 28, objectFit: 'contain', background: 'white', padding: 3 }} />
            <span className="font-black tracking-[0.15em] uppercase text-sm text-slate-100">
              FLU<span style={{ color: '#00b0ff' }}>X</span>TIC
            </span>
          </div>

          {/* Page content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </>
  )
}
