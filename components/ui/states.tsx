import type { ReactNode } from 'react'

export function LoadingState() {
  return <p className="py-6 text-caption text-muted">Загрузка…</p>
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-body text-danger">
      {message}
    </p>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded border border-line px-3 py-6 text-center text-body text-muted">{children}</p>
}
