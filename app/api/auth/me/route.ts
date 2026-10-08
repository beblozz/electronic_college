import { NextResponse } from 'next/server'
import { loadSessionUser, requireSession } from '@/lib/auth'
import { route, unauthenticated } from '@/lib/http'

export const GET = route(async () => {
  const session = await requireSession()
  const user = await loadSessionUser(session.userId)
  if (!user) {
    throw unauthenticated()
  }
  const { student, teacher, ...profile } = user
  return NextResponse.json({ user: profile, student, teacher })
})
