import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { homePathForRole } from '@/lib/session-token'

export default async function RootPage() {
  const session = await getSession()
  redirect(session ? homePathForRole(session.role) : '/login')
}
