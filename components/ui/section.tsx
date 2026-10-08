import type { ReactNode } from 'react'

type SectionProps = { title: string; children: ReactNode; aside?: ReactNode; className?: string }

export function Section({ title, children, aside, className = '' }: SectionProps) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-body font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}
