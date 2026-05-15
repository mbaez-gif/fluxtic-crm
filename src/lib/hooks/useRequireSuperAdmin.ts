'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthContext } from '@/components/auth/AuthProvider'

// Redirige a /dashboard si el usuario no es super_admin.
// Loading state debe manejarse en el componente que lo invoca.
export function useRequireSuperAdmin() {
  const { user, profile, loading, initialized } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (!initialized || loading) return
    if (!user) { router.replace('/auth/login'); return }
    if (profile?.rol !== 'super_admin') { router.replace('/dashboard') }
  }, [user, profile, loading, initialized, router])

  return {
    ready: initialized && !loading && !!user && profile?.rol === 'super_admin',
    profile,
  }
}
