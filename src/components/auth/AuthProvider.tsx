'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useAuth }    from '@/lib/hooks/useAuth'
import { useRouter }  from 'next/navigation'
import { useEffect }  from 'react'
import type { FluxticUser } from '@/types'
import type { User }        from 'firebase/auth'

interface AuthContextValue {
  user:        User | null
  profile:     FluxticUser | null
  loading:     boolean
  initialized: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>')
  return ctx
}

// ── Guard for protected pages ─────────────────────────────
export function useRequireAuth() {
  const { user, loading, initialized } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (initialized && !loading && !user) {
      router.replace('/auth/login')
    }
  }, [user, loading, initialized, router])

  return { user, loading }
}
