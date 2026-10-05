import type { ReactNode } from 'react'

type PageHeaderProps = { title: string; caption?: string; children?: ReactNode }

export function PageHeader({ title, caption, children }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-title font-medium">{title}</h1>
        {caption ? <p className="text-caption text-muted">{caption}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-end gap-2">{children}</div> : null}
    </div>
  )
}
