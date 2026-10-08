import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { ShellFrame } from '@/components/layout/shell-frame'
import { getSession, loadSessionUser } from '@/lib/auth'

export async function AppShell({ children }: { children: ReactNode }) {
  const session = await getSession()
  const user = session ? await loadSessionUser(session.userId) : null
  if (!user) {
    redirect('/api/auth/logout')
  }
  return <ShellFrame user={user}>{children}</ShellFrame>
}
