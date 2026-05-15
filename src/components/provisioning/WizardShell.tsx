'use client'

import { cn } from '@/lib/utils'
import { Check, Lock } from 'lucide-react'

export interface WizardStepDef {
  id:    number
  label: string
}

export function WizardProgress({
  steps,
  current,
  visited,
}: {
  steps:   WizardStepDef[]
  current: number
  visited: Set<number>
}) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5 px-4 md:px-8 py-3 border-b border-white/5 text-xs">
      {steps.map((s) => {
        const done = visited.has(s.id) && s.id < current
        const active = s.id === current
        const reachable = visited.has(s.id) || s.id <= current
        return (
          <li key={s.id}
            className={cn(
              'flex items-center gap-2 px-2.5 py-1 rounded-full border',
              active   && 'border-flux-teal text-flux-teal bg-flux-tealGlow',
              done     && 'border-flux-border text-flux-text2',
              !active && !done && reachable && 'border-flux-border text-flux-text3',
              !reachable && 'border-flux-border text-flux-text3 opacity-50',
            )}>
            <span className={cn(
              'w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold',
              active ? 'bg-flux-teal text-[#0a0d12]' :
              done   ? 'bg-flux-success text-[#0a0d12]' :
                       'bg-flux-muted text-flux-text3',
            )}>
              {done ? <Check size={10} /> : !reachable ? <Lock size={9}/> : s.id}
            </span>
            {s.label}
          </li>
        )
      })}
    </ol>
  )
}

export function WizardFooter({
  step,
  total,
  canNext,
  loading,
  onBack,
  onNext,
  nextLabel,
}: {
  step:      number
  total:     number
  canNext:   boolean
  loading?:  boolean
  onBack?:   () => void
  onNext?:   () => void
  nextLabel?: string
}) {
  return (
    <div className="sticky bottom-0 flex items-center justify-between px-4 md:px-8 py-3 border-t border-white/5 bg-flux-bg">
      <button type="button"
        onClick={onBack}
        disabled={step <= 1 || loading}
        className={cn(
          'px-4 py-2 text-sm rounded-lg border border-flux-border text-flux-text2',
          'hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed',
        )}>
        Atrás
      </button>
      <div className="text-xs text-flux-text3">Paso {step} de {total}</div>
      <button type="button"
        onClick={onNext}
        disabled={!canNext || loading}
        className={cn(
          'px-4 py-2 text-sm rounded-lg font-medium',
          'bg-flux-teal text-[#0a0d12] hover:bg-flux-tealDim',
          'disabled:bg-flux-muted disabled:text-flux-text3 disabled:cursor-not-allowed',
        )}>
        {loading ? '…' : (nextLabel ?? 'Siguiente')}
      </button>
    </div>
  )
}

export function WizardSection({
  title,
  subtitle,
  children,
}: {
  title:    string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="px-4 md:px-8 py-6 space-y-5">
      <header>
        <h2 className="font-display text-lg text-flux-white">{title}</h2>
        {subtitle && <p className="text-xs text-flux-text3 mt-1">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label:    string
  hint?:    string
  error?:   string | null
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-flux-text2">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && !error && <span className="text-2xs text-flux-text3 mt-1 block">{hint}</span>}
      {error && <span className="text-2xs text-flux-danger mt-1 block">{error}</span>}
    </label>
  )
}

export function inputClass(extra = '') {
  return cn(
    'w-full px-3 py-2 rounded-lg bg-flux-surface border border-flux-border',
    'text-sm text-flux-white placeholder:text-flux-text3',
    'focus:outline-none focus:border-flux-teal',
    extra,
  )
}
