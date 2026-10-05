'use client'

import { X } from 'lucide-react'
import { ReactNode, useEffect } from 'react'

type DialogProps = {
  title: string
  onClose: () => void
  children: ReactNode
  width?: 'narrow' | 'wide'
}

export function Dialog({ title, onClose, children, width = 'narrow' }: DialogProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-[10vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full rounded-lg border border-line bg-surface shadow-popover ${width === 'wide' ? 'max-w-3xl' : 'max-w-md'}`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-body font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded p-1 text-muted transition-colors hover:bg-subtle hover:text-ink"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
