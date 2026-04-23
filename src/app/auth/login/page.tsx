'use client'

import { useState }     from 'react'
import { useRouter }    from 'next/navigation'
import { useForm }      from 'react-hook-form'
import { zodResolver }  from '@hookform/resolvers/zod'
import { z }            from 'zod'
import { signIn }       from '@/lib/firebase/auth'
import { cn }           from '@/lib/utils'
import { Zap, Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'

const schema = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const router  = useRouter()
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setError(null)
    try {
      await signIn(values.email, values.password)
      router.replace('/dashboard')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found') {
        setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Espera unos minutos.')
      } else {
        setError('Error al iniciar sesión. Inténtalo de nuevo.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-flux-bg flex">

      {/* Left — decorative panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-flux-surface border-r border-flux-border p-12 relative overflow-hidden">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#00D4A8 1px, transparent 1px), linear-gradient(90deg, #00D4A8 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Glow */}
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-flux-teal opacity-5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative">
          <div className="w-9 h-9 rounded-xl bg-flux-teal flex items-center justify-center shadow-teal-md">
            <Zap size={18} className="text-flux-bg" strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-xl text-flux-white">Fluxtic</span>
        </div>

        {/* Quote */}
        <div className="relative">
          <p className="font-display text-3xl font-bold text-flux-white leading-tight mb-4">
            Tu ciclo comercial,<br />
            <span className="text-flux-teal">sin fricción.</span>
          </p>
          <p className="text-sm text-flux-text3 leading-relaxed max-w-sm">
            Desde el primer lead hasta el abono mensual,
            Fluxtic centraliza cada paso de la consultora.
          </p>
        </div>

        {/* Stats */}
        <div className="flex gap-8 relative">
          {[
            { label: 'Leads gestionados', value: '∞' },
            { label: 'Módulos integrados', value: '8'  },
            { label: 'Tiempo real',        value: '✓'  },
          ].map(s => (
            <div key={s.label}>
              <p className="font-display text-2xl font-bold text-flux-teal">{s.value}</p>
              <p className="text-2xs text-flux-text3 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm animate-fade-in">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-flux-teal flex items-center justify-center">
              <Zap size={14} className="text-flux-bg" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-lg text-flux-white">Fluxtic</span>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-flux-white mb-2">
              Bienvenido de nuevo
            </h1>
            <p className="text-sm text-flux-text3">
              Accede a tu panel de Fluxtic CRM
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3"
                />
                <input
                  type="email"
                  placeholder="tu@fluxtic.com"
                  className={cn(
                    'flux-input pl-9',
                    errors.email && 'border-flux-danger focus:border-flux-danger focus:ring-flux-danger'
                  )}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-2xs text-flux-danger">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-flux-text2 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-flux-text3"
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  className={cn(
                    'flux-input pl-9',
                    errors.password && 'border-flux-danger focus:border-flux-danger focus:ring-flux-danger'
                  )}
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-2xs text-flux-danger">{errors.password.message}</p>
              )}
            </div>

            {/* Global error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-xs">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'btn-primary w-full flex items-center justify-center gap-2 py-2.5',
                isSubmitting && 'opacity-70 cursor-not-allowed'
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-flux-bg border-t-transparent animate-spin" />
                  Accediendo…
                </>
              ) : (
                <>
                  Acceder
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-flux-text3">
            ¿Olvidaste tu contraseña?{' '}
            <button
              type="button"
              className="text-flux-teal hover:underline transition-colors"
              onClick={() => {
                // TODO: add password reset flow
                alert('Contacta con el administrador para restablecer tu contraseña.')
              }}
            >
              Restablecer
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
