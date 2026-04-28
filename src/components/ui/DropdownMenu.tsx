'use client'

import {
  useState, useEffect, useRef,
  createPortal,
} from 'react'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DropdownItem {
  label:     string
  icon?:     React.ReactNode
  onClick:   () => void
  danger?:   boolean
  disabled?: boolean
}

interface Props {
  items:     DropdownItem[]
  align?:    'left' | 'right'
  className?: string
}

/**
 * DropdownMenu — renders the menu in a portal fixed to the viewport.
 * This avoids the z-index / overflow:hidden clipping issue in tables.
 */
export function DropdownMenu({ items, align = 'right', className }: Props) {
  const [open,    setOpen]    = useState(false)
  const [pos,     setPos]     = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  // Position the portal menu below the button
  function openMenu() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({
      top:  rect.bottom + window.scrollY + 4,
      left: align === 'right'
        ? rect.right  + window.scrollX - 160  // 160 = min menu width
        : rect.left   + window.scrollX,
    })
    setOpen(true)
  }

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return
    function close() { setOpen(false) }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); open ? setOpen(false) : openMenu() }}
        className={cn(
          'p-1.5 rounded-lg text-flux-text3 hover:text-flux-text1 hover:bg-flux-muted transition-colors',
          className
        )}
      >
        <MoreHorizontal size={15} />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position:    'fixed',
            top:         pos.top,
            left:        pos.left,
            zIndex:      99999,
            minWidth:    160,
            background:  '#0d1829',
            border:      '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            boxShadow:   '0 8px 32px rgba(0,0,0,0.5)',
            padding:     '4px',
            animation:   'fadeIn 0.12s ease',
          }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => { item.onClick(); setOpen(false) }}
              className={cn(
                'w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors',
                item.danger
                  ? 'text-red-400 hover:bg-red-950/50'
                  : 'text-flux-text2 hover:bg-flux-muted hover:text-flux-text1',
                item.disabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
