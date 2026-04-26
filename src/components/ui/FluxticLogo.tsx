import { cn } from '@/lib/utils'

interface Props {
  size?:      'sm' | 'md' | 'lg' | 'xl' | 'splash'
  showText?:  boolean
  showSub?:   boolean
  animated?:  boolean
  className?: string
}

const SIZES = {
  sm:     { icon: 28,  text: 14, sub: 8  },
  md:     { icon: 40,  text: 18, sub: 9  },
  lg:     { icon: 60,  text: 26, sub: 11 },
  xl:     { icon: 90,  text: 38, sub: 13 },
  splash: { icon: 140, text: 52, sub: 15 },
}

export function FluxticLogo({
  size = 'md',
  showText = true,
  showSub = false,
  animated = false,
  className,
}: Props) {
  const s = SIZES[size]

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Icon */}
      <div className={cn('relative shrink-0', animated && 'animate-pulse-slow')}>
        <svg
          width={s.icon}
          height={s.icon}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={animated ? 'drop-shadow-[0_0_12px_rgba(0,176,255,0.6)]' : ''}
        >
          {/* Gear shape — dark navy */}
          <path
            d="M50 20 L55 10 L60 20 L70 15 L72 26 L83 24 L80 35 L90 38 L84 47 L92 54 L83 58 L86 70 L74 69 L70 80 L60 75 L55 85 L50 75 L40 80 L36 69 L24 70 L28 58 L18 54 L26 47 L20 38 L30 35 L28 24 L38 26 L40 15 Z"
            fill="#1a2744"
            className={animated ? 'origin-center' : ''}
          />
          {/* Inner gear cutout */}
          <circle cx="50" cy="50" r="18" fill="#0f1829" />

          {/* Circuit lines — bright blue */}
          {/* Main arc */}
          <path
            d="M 46 38 Q 32 50 46 62"
            stroke="#00b0ff"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Three horizontal lines */}
          <line x1="46" y1="42" x2="72" y2="42" stroke="#00b0ff" strokeWidth="3" strokeLinecap="round" />
          <line x1="46" y1="50" x2="76" y2="50" stroke="#00b0ff" strokeWidth="3" strokeLinecap="round" />
          <line x1="46" y1="58" x2="72" y2="58" stroke="#00b0ff" strokeWidth="3" strokeLinecap="round" />

          {/* Endpoint dots */}
          <circle cx="72" cy="42" r="3.5" fill="#00b0ff" />
          <circle cx="76" cy="50" r="3.5" fill="#00b0ff" />
          <circle cx="72" cy="58" r="3.5" fill="#00b0ff" />

          {/* Animated glow dots */}
          {animated && (
            <>
              <circle cx="72" cy="42" r="3.5" fill="#00b0ff" opacity="0.6">
                <animate attributeName="r" values="3.5;6;3.5" dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="76" cy="50" r="3.5" fill="#00b0ff" opacity="0.6">
                <animate attributeName="r" values="3.5;6;3.5" dur="2.3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2.3s" repeatCount="indefinite" />
              </circle>
              <circle cx="72" cy="58" r="3.5" fill="#00b0ff" opacity="0.6">
                <animate attributeName="r" values="3.5;6;3.5" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.8s" repeatCount="indefinite" />
              </circle>
              {/* Traveling dot on middle line */}
              <circle cx="46" cy="50" r="2.5" fill="white">
                <animate attributeName="cx" values="46;76;46" dur="1.5s" repeatCount="indefinite" />
              </circle>
            </>
          )}
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <div className="text-center">
          <p
            className="font-black tracking-[0.25em] uppercase"
            style={{ fontSize: s.text, letterSpacing: '0.2em' }}
          >
            <span style={{ color: '#1a2744' }} className="[.dark_&]:hidden">FLU</span>
            <span style={{ color: '#00b0ff' }} className="[.dark_&]:hidden">X</span>
            <span style={{ color: '#1a2744' }} className="[.dark_&]:hidden">TIC</span>
            {/* Dark mode */}
            <span style={{ color: '#e2e8f0' }} className="hidden [.dark_&]:inline">FLU</span>
            <span style={{ color: '#00b0ff' }} className="hidden [.dark_&]:inline">X</span>
            <span style={{ color: '#e2e8f0' }} className="hidden [.dark_&]:inline">TIC</span>
          </p>
          {showSub && (
            <p
              className="tracking-[0.3em] uppercase font-medium mt-1"
              style={{ fontSize: s.sub, color: '#64748b', letterSpacing: '0.28em' }}
            >
              — Automatizaciones Inteligentes —
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Dark-mode aware version for use inside the app
export function FluxticLogoDark({
  size = 'md',
  showText = true,
  animated = false,
  className,
}: Omit<Props, 'showSub'>) {
  const s = SIZES[size]

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        width={s.icon * 0.7}
        height={s.icon * 0.7}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={animated ? 'drop-shadow-[0_0_8px_rgba(0,176,255,0.5)]' : ''}
      >
        <path
          d="M50 20 L55 10 L60 20 L70 15 L72 26 L83 24 L80 35 L90 38 L84 47 L92 54 L83 58 L86 70 L74 69 L70 80 L60 75 L55 85 L50 75 L40 80 L36 69 L24 70 L28 58 L18 54 L26 47 L20 38 L30 35 L28 24 L38 26 L40 15 Z"
          fill="#1e3a5f"
        />
        <circle cx="50" cy="50" r="18" fill="#0d1f35" />
        <path d="M 46 38 Q 32 50 46 62" stroke="#00b0ff" strokeWidth="3.5" strokeLinecap="round" fill="none" />
        <line x1="46" y1="42" x2="72" y2="42" stroke="#00b0ff" strokeWidth="3" strokeLinecap="round" />
        <line x1="46" y1="50" x2="76" y2="50" stroke="#00b0ff" strokeWidth="3" strokeLinecap="round" />
        <line x1="46" y1="58" x2="72" y2="58" stroke="#00b0ff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="72" cy="42" r="3.5" fill="#00b0ff" />
        <circle cx="76" cy="50" r="3.5" fill="#00b0ff" />
        <circle cx="72" cy="58" r="3.5" fill="#00b0ff" />
        {animated && (
          <circle cx="46" cy="50" r="2.5" fill="white">
            <animate attributeName="cx" values="46;76;46" dur="1.5s" repeatCount="indefinite" />
          </circle>
        )}
      </svg>
      {showText && (
        <span className="font-black tracking-[0.2em] uppercase" style={{ fontSize: s.text }}>
          <span className="text-slate-200">FLU</span>
          <span style={{ color: '#00b0ff' }}>X</span>
          <span className="text-slate-200">TIC</span>
        </span>
      )}
    </div>
  )
}
