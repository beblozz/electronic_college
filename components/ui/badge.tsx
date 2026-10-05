import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'danger' | 'warning' | 'success'

const toneClasses: Record<Tone, string> = {
  neutral: 'border-line bg-subtle text-muted',
  accent: 'border-blue-200 bg-blue-50 text-accent',
  danger: 'border-red-200 bg-red-50 text-danger',
  warning: 'border-amber-200 bg-loadMedium text-amber-800',
  success: 'border-green-200 bg-loadLow text-green-800',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 text-caption ${toneClasses[tone]}`}>
      {children}
    </span>
  )
}
