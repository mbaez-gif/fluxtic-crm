import { cn } from '@/lib/utils'
import { type ReactNode } from 'react'

// ── Badge ─────────────────────────────────────────────────
const badgeVariants = {
  default:  'bg-flux-muted text-flux-text2',
  success:  'bg-emerald-950 text-emerald-400',
  warning:  'bg-amber-950  text-amber-400',
  danger:   'bg-rose-950   text-rose-400',
  info:     'bg-blue-950   text-blue-400',
  teal:     'bg-flux-tealGlow text-flux-teal',
}

type BadgeVariant = keyof typeof badgeVariants

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children:  ReactNode
  variant?:  BadgeVariant
  className?: string
}) {
  return (
    <span className={cn('badge', badgeVariants[variant], className)}>
      {children}
    </span>
  )
}

// ── Spinner ───────────────────────────────────────────────
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-2 border-flux-border border-t-flux-teal animate-spin"
    />
  )
}

// ── Empty state ───────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?:        ReactNode
  title:        string
  description?: string
  action?:      ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      {icon && (
        <div className="mb-4 text-flux-text3 opacity-40">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-flux-text2">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-flux-text3 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────
export function StatCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string
  value: string | number
  delta?: string
  icon?:  ReactNode
}) {
  return (
    <div className="flux-card flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-flux-text3 font-medium uppercase tracking-widest">
          {label}
        </span>
        {icon && <span className="text-flux-text3">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="font-display text-2xl font-bold text-flux-white">
          {value}
        </span>
        {delta && (
          <span className={cn(
            'text-xs mb-0.5',
            delta.startsWith('+') ? 'text-flux-success' : 'text-flux-danger'
          )}>
            {delta}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Divider ───────────────────────────────────────────────
export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-flux-border', className)} />
}
