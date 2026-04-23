import { type ReactNode } from 'react'

interface PageHeaderProps {
  title:       string
  subtitle?:   string
  actions?:    ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between px-8 pt-8 pb-6">
      <div>
        <h1 className="font-display text-xl font-bold text-flux-white tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-flux-text3">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 mt-1">
          {actions}
        </div>
      )}
    </header>
  )
}
