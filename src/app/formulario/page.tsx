'use client'

import { useState }    from 'react'
import { useForm }     from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z }           from 'zod'
import { Zap, CheckCircle, AlertCircle } from 'lucide-react'

const schema = z.object({
  nombre:   z.string().min(2, 'Requerido'),
  empresa:  z.string().min(1, 'Requerido'),
  email:    z.string().email('Email inválido'),
  telefono: z.string().optional(),
  interes:  z.string().min(1, 'Selecciona una opción'),
  mensaje:  z.string().optional(),
})
type FormValues = z.infer<typeof schema>

const INTERESES = [
  'Automatización de procesos',
  'Consultoría estratégica',
  'Transformación digital',
  'Formación y capacitación',
  'Otro',
]

export default function FormularioPage() {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setStatus('idle')
    try {
      const res = await fetch('/api/leads/webhook', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...values, origen: 'Formulario web Fluxtic' }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setStatus('success')
        reset()
      } else {
        setStatus('error')
        setErrorMsg(data.error ?? 'Error al enviar el formulario')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Error de conexión. Intenta de nuevo.')
    }
  }

  return (
    <div className="min-h-screen bg-flux-bg flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-flux-teal flex items-center justify-center">
              <Zap size={16} className="text-flux-bg" strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-lg text-flux-white">Fluxtic</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-flux-white mb-2">
            Hablemos de tu proyecto
          </h1>
          <p className="text-sm text-flux-text3">
            Cuéntanos qué necesitas y te contactamos en menos de 24 horas.
          </p>
        </div>

        {/* Success state */}
        {status === 'success' ? (
          <div className="flux-card text-center py-10">
            <CheckCircle size={48} className="text-flux-teal mx-auto mb-4" />
            <h2 className="font-display font-bold text-xl text-flux-white mb-2">
              ¡Mensaje recibido!
            </h2>
            <p className="text-sm text-flux-text3">
              Nos pondremos en contacto contigo en menos de 24 horas.
            </p>
            <button
              onClick={() => setStatus('idle')}
              className="btn-ghost mt-6 text-sm"
            >
              Enviar otro mensaje
            </button>
          </div>
        ) : (
          <div className="flux-card">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Nombre *</label>
                  <input className={`flux-input ${errors.nombre ? 'border-flux-danger' : ''}`}
                    placeholder="Ana García" {...register('nombre')} />
                  {errors.nombre && <p className="mt-1 text-2xs text-flux-danger">{errors.nombre.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Empresa *</label>
                  <input className={`flux-input ${errors.empresa ? 'border-flux-danger' : ''}`}
                    placeholder="Acme S.L." {...register('empresa')} />
                  {errors.empresa && <p className="mt-1 text-2xs text-flux-danger">{errors.empresa.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Email *</label>
                  <input type="email" className={`flux-input ${errors.email ? 'border-flux-danger' : ''}`}
                    placeholder="ana@acme.com" {...register('email')} />
                  {errors.email && <p className="mt-1 text-2xs text-flux-danger">{errors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-flux-text2 mb-1.5">Teléfono</label>
                  <input className="flux-input" placeholder="+34 600 000 000" {...register('telefono')} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">¿En qué podemos ayudarte? *</label>
                <select className={`flux-input ${errors.interes ? 'border-flux-danger' : ''}`} {...register('interes')}>
                  <option value="">Selecciona una opción…</option>
                  {INTERESES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                {errors.interes && <p className="mt-1 text-2xs text-flux-danger">{errors.interes.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-flux-text2 mb-1.5">
                  Cuéntanos más <span className="text-flux-text3 font-normal">(opcional)</span>
                </label>
                <textarea rows={4} className="flux-input resize-none"
                  placeholder="Describe tu proyecto, situación actual, objetivo principal…"
                  {...register('mensaje')} />
              </div>

              {status === 'error' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-950 border border-rose-800 text-rose-300 text-xs">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {errorMsg}
                </div>
              )}

              <button type="submit" disabled={isSubmitting}
                className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                {isSubmitting
                  ? <><div className="w-4 h-4 border-2 border-flux-bg border-t-transparent rounded-full animate-spin" /> Enviando…</>
                  : 'Enviar mensaje'}
              </button>

              <p className="text-2xs text-flux-text3 text-center">
                Al enviar aceptas nuestra política de privacidad. Sin spam, prometido.
              </p>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
