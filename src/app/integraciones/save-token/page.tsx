'use client'

import { useEffect, useState } from 'react'
import { useRouter }           from 'next/navigation'
import { useAuthContext }      from '@/components/auth/AuthProvider'
import { db }                  from '@/lib/firebase/config'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { AppShell }            from '@/components/layout/AppShell'
import { Spinner }             from '@/components/ui'
import { CheckCircle, XCircle } from 'lucide-react'

export default function SaveTokenPage() {
  const router        = useRouter()
  const { user }      = useAuthContext()
  const [status, setStatus] = useState<'saving' | 'ok' | 'error'>('saving')

  useEffect(() => {
    if (!user) return

    async function saveToken() {
      try {
        const params      = new URLSearchParams(window.location.search)
        const accessToken  = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const expiryDate   = params.get('expiry_date')
        const tokenType    = params.get('token_type') ?? 'Bearer'
        const uid          = params.get('uid')

        if (!accessToken || !uid || uid !== user!.uid) {
          setStatus('error')
          return
        }

        // Save tokens to Firestore using the user's own Auth session
        await setDoc(doc(db, 'googleTokens', user!.uid), {
          access_token:  accessToken,
          refresh_token: refreshToken ?? '',
          expiry_date:   expiryDate ? parseInt(expiryDate) : null,
          token_type:    tokenType,
          actualizadoEn: serverTimestamp(),
        }, { merge: true })

        setStatus('ok')
        setTimeout(() => router.replace('/integraciones?connected=google'), 1500)
      } catch (err) {
        console.error('Error saving token:', err)
        setStatus('error')
      }
    }

    saveToken()
  }, [user, router])

  return (
    <AppShell>
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4 text-center">
          {status === 'saving' && (
            <>
              <Spinner size={32} />
              <p className="text-sm text-flux-text2">Conectando con Google…</p>
            </>
          )}
          {status === 'ok' && (
            <>
              <CheckCircle size={40} className="text-flux-teal" />
              <p className="text-sm text-flux-text1 font-medium">¡Google conectado!</p>
              <p className="text-xs text-flux-text3">Redirigiendo…</p>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={40} className="text-flux-danger" />
              <p className="text-sm text-flux-text1 font-medium">Error al conectar</p>
              <button
                onClick={() => router.replace('/integraciones')}
                className="btn-ghost text-xs mt-2"
              >
                Volver a Integraciones
              </button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}
