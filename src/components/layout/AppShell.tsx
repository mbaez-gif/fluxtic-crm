'use client'

import { useRequireAuth } from '@/components/auth/AuthProvider'
import { Sidebar }        from '@/components/layout/Sidebar'
import { AuthProvider }   from '@/components/auth/AuthProvider'

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { loading } = useRequireAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-flux-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-flux-teal border-t-transparent animate-spin" />
          <p className="text-xs text-flux-text3">Cargando Fluxtic…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-flux-bg">
      <Sidebar />
      <main className="flex-1 min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShellInner>{children}</AppShellInner>
    </AuthProvider>
  )
}
