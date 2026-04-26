interface Props {
  title:    string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 md:px-8 py-4 md:py-6 border-b border-white/5">
      <div className="min-w-0">
        <h1 className="font-display font-bold text-lg md:text-xl text-flux-white truncate">{title}</h1>
        {subtitle && <p className="text-xs text-flux-text3 mt-0.5">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  )
}
