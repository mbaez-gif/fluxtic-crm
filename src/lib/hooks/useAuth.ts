'use client'

import { useEffect, useState } from 'react'
import { type User }           from 'firebase/auth'
import { onAuthChange, getOrCreateUserProfile } from '@/lib/firebase/auth'
import type { FluxticUser }    from '@/types'

interface AuthState {
  user:        User | null
  profile:     FluxticUser | null
  loading:     boolean
  initialized: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user:        null,
    profile:     null,
    loading:     true,
    initialized: false,
  })

  useEffect(() => {
    const unsubscribe = onAuthChange(async firebaseUser => {
      if (firebaseUser) {
        const profile = await getOrCreateUserProfile(firebaseUser)
        setState({ user: firebaseUser, profile, loading: false, initialized: true })
      } else {
        setState({ user: null, profile: null, loading: false, initialized: true })
      }
    })
    return unsubscribe
  }, [])

  return state
}
