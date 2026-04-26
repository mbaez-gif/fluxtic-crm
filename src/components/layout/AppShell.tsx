'use client'

import { useState, useEffect } from 'react'
import { useRouter }      from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'
import { Sidebar }        from '@/components/layout/Sidebar'
import { SplashScreen }   from '@/components/ui/SplashScreen'

interface Props {
  children: React.ReactNode
}

const SPLASH_KEY = 'fluxtic_splash_shown'

export function AppShell({ children }: Props) {
  const { user, loading, initialized } = useAuthContext()
  const router   = useRouter()
  const [showSplash, setShowSplash] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  // Show splash only once per session
  useEffect(() => {
    const shown = sessionStorage.getItem(SPLASH_KEY)
    if (!shown) {
      setShowSplash(true)
      sessionStorage.setItem(SPLASH_KEY, '1')
    } else {
      setSplashDone(true)
    }
  }, [])

  // Auth guard — redirect to login if not authenticated
  useEffect(() => {
    if (initialized && !loading && !user) {
      router.replace('/auth/login')
    }
  }, [user, loading, initialized, router])

  function handleSplashDone() {
    setShowSplash(false)
    setSplashDone(true)
  }

  // While checking auth — show nothing (avoids flash)
  if (!initialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: '#060910' }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/fluxtic-logo.jpg" alt="Fluxtic"
            className="rounded-xl animate-pulse"
            style={{ width: 56, height: 56, objectFit: 'contain', background: 'white', padding: 6 }} />
          <div className="h-0.5 w-24 overflow-hidden rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="h-full rounded-full animate-loading-bar"
              style={{ background: 'linear-gradient(90deg, #00b0ff, #0077cc)' }} />
          </div>
        </div>
      </div>
    )
  }

  // Not authenticated — don't render anything (redirect in progress)
  if (!user) return null

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <div className="flex min-h-screen bg-flux-bg"
        style={{ opacity: showSplash ? 0 : 1, transition: 'opacity 0.3s ease' }}>
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </>
  )
}
