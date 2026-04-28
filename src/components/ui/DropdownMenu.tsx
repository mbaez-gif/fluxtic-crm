'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DropdownItem {
  label:     string
  icon?:     React.ReactNode
  onClick:   () => void
  danger?:   boolean
  disabled?: boolean
}

interface Props {
  items:      DropdownItem[]
  align?:     'left' | 'right'
  className?: string
}

/**
 * DropdownMenu — renders in a portal fixed to the viewport.
 * Fixes z-index / overflow:hidden clipping in tables.
 */
export function DropdownMenu({ items, align = 'right', className }: Props) {
  const [open,      setOpen]      = useState(false)
  const [pos,       setPos]       = useState({ top: 0, left: 0 })
  const [mounted,   setMounted]   = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setMounted(true) }, [])

  function openMenu() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const menuW = 180
    setPos({
      top:  rect.bottom + 4,
      left: align === 'right'
        ? Math.max(4, rect.right - menuW)
        : rect.left,
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (btnRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function closeScroll() { setOpen(false) }
    setTimeout(() => document.addEventListener('mousedown', close), 0)
    window.addEventListener('scroll', closeScroll, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', closeScroll, true)
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

      {open && mounted && createPortal(
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position:     'fixed',
            top:          pos.top,
            left:         pos.left,
            zIndex:       99999,
            minWidth:     180,
            background:   '#0d1829',
            border:       '1px solid rgba(255,255,255,0.09)',
            borderRadius: 12,
            boxShadow:    '0 8px 32px rgba(0,0,0,0.6)',
            padding:      4,
          }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              disabled={item.disabled}
              onClick={() => { item.onClick(); setOpen(false) }}
              className={cn(
                'w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                item.danger
                  ? 'text-red-400 hover:bg-red-950/50'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
                item.disabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              {item.icon && <span className="shrink-0 opacity-70">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
