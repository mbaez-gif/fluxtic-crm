'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { signIn }              from '@/lib/firebase/auth'
import { useAuthContext }      from '@/components/auth/AuthProvider'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router  = useRouter()
  const { user, initialized } = useAuthContext()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  // If already logged in — redirect immediately
  useEffect(() => {
    if (initialized && user) {
      router.replace('/dashboard')
    }
  }, [user, initialized, router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      await signIn(email.trim(), password)
      // Don't call router.replace here — the useEffect above handles it
      // when AuthProvider updates the user state
    } catch (err: any) {
      const code = err?.code ?? ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Email o contraseña incorrectos')
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos. Esperá unos minutos.')
      } else {
        setError('Error al iniciar sesión. Intentá de nuevo.')
      }
      setLoading(false)
    }
    // Note: don't setLoading(false) on success — keep spinner while redirect happens
  }

  // Show nothing while checking if already logged in
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: '#060910' }}>
        <img src="/fluxtic-logo.jpg" alt="Fluxtic"
          className="rounded-xl animate-pulse"
          style={{ width: 56, height: 56, objectFit: 'contain', background: 'white', padding: 6 }} />
      </div>
    )
  }

  // Already logged in — show nothing while redirecting
  if (user) return null

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #060910 0%, #0d1829 50%, #0a1520 100%)' }}
    >
      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'linear-gradient(#00b0ff 1px, transparent 1px), linear-gradient(90deg, #00b0ff 1px, transparent 1px)',
          backgroundSize:  '50px 50px',
        }}
      />

      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="rounded-full" style={{
          width: '800px', height: '800px',
          background: 'radial-gradient(circle, rgba(0,176,255,0.08) 0%, transparent 65%)',
        }} />
      </div>

      {/* Corner decorations */}
      <div className="absolute top-6 left-6 w-6 h-6 border-l-2 border-t-2 border-blue-400/20 rounded-tl" />
      <div className="absolute top-6 right-6 w-6 h-6 border-r-2 border-t-2 border-blue-400/20 rounded-tr" />
      <div className="absolute bottom-6 left-6 w-6 h-6 border-l-2 border-b-2 border-blue-400/20 rounded-bl" />
      <div className="absolute bottom-6 right-6 w-6 h-6 border-r-2 border-b-2 border-blue-400/20 rounded-br" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div
          className="rounded-2xl p-8 border"
          style={{
            background:     'rgba(13, 24, 41, 0.85)',
            backdropFilter: 'blur(20px)',
            borderColor:    'rgba(255,255,255,0.08)',
            boxShadow:      '0 0 40px rgba(0,176,255,0.08), 0 25px 50px rgba(0,0,0,0.5)',
          }}
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'radial-gradient(circle, rgba(0,176,255,0.3) 0%, transparent 70%)',
                  filter:     'blur(15px)',
                  transform:  'scale(1.3)',
                }} />
              <img
                src="/fluxtic-logo.jpg"
                alt="Fluxtic"
                className="relative rounded-2xl"
                style={{
                  width: 90, height: 90,
                  objectFit: 'contain',
                  background: 'white',
                  padding: '8px',
                  boxShadow: '0 0 24px rgba(0,176,255,0.25)',
                }}
              />
            </div>
            <h1 className="font-black uppercase tracking-[0.25em] mb-1"
              style={{ fontSize: 28, color: '#f1f5f9' }}>
              FLU<span style={{ color: '#00b0ff' }}>X</span>TIC
            </h1>
            <p className="uppercase tracking-[0.3em] font-medium"
              style={{ fontSize: 9, color: '#475569' }}>
              — Automatizaciones Inteligentes —
            </p>
            <div className="flex items-center gap-3 mt-6 w-full">
              <div className="h-px flex-1"
                style={{ background: 'linear-gradient(to right, transparent, rgba(0,176,255,0.3))' }} />
              <p className="text-xs text-slate-400 font-medium">Acceso al CRM</p>
              <div className="h-px flex-1"
                style={{ background: 'linear-gradient(to left, transparent, rgba(0,176,255,0.3))' }} />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@fluxtic.com"
                autoComplete="email"
                disabled={loading}
                className="w-full px-4 py-3 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all disabled:opacity-60"
                style={{
                  background:  'rgba(255,255,255,0.04)',
                  border:      '1px solid rgba(255,255,255,0.08)',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,176,255,0.5)'}
                onBlur={e  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition-all disabled:opacity-60"
                  style={{
                    background:  'rgba(255,255,255,0.04)',
                    border:      '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(0,176,255,0.5)'}
                  onBlur={e  => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
                <button type="button" onClick={() => setShowPwd(p => !p)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl text-xs text-red-400"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all mt-2"
              style={{
                background: 'linear-gradient(135deg, #00b0ff, #0077cc)',
                color:      '#060910',
                boxShadow:  '0 4px 20px rgba(0,176,255,0.3)',
                opacity:    loading || !email.trim() || !password.trim() ? 0.6 : 1,
                cursor:     loading ? 'wait' : !email.trim() || !password.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Ingresando…</>
                : <><ArrowRight size={16} /> Ingresar al CRM</>}
            </button>
          </form>

          <p className="text-center text-2xs text-slate-600 mt-6">
            Fluxtic CRM · Acceso restringido al equipo
          </p>
        </div>
      </div>
    </div>
  )
}
