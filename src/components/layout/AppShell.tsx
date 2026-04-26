'use client'

import { useState, useEffect } from 'react'
import { Sidebar }      from '@/components/layout/Sidebar'
import { SplashScreen } from '@/components/ui/SplashScreen'

interface Props {
  children: React.ReactNode
}

const SPLASH_KEY = 'fluxtic_splash_shown'

export function AppShell({ children }: Props) {
  const [showSplash, setShowSplash] = useState(false)
  const [mounted,    setMounted]    = useState(false)

  useEffect(() => {
    setMounted(true)
    // Show splash only once per session
    const shown = sessionStorage.getItem(SPLASH_KEY)
    if (!shown) {
      setShowSplash(true)
      sessionStorage.setItem(SPLASH_KEY, '1')
    }
  }, [])

  function handleSplashDone() {
    setShowSplash(false)
  }

  if (!mounted) return null

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <div className="flex min-h-screen bg-flux-bg">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </>
  )
}
