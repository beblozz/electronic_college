'use client'

import { useApi } from '@/lib/client/api'
import type { SessionUser } from '@/lib/types'

type MeResponse = {
  user: Omit<SessionUser, 'student' | 'teacher'>
  student: SessionUser['student']
  teacher: SessionUser['teacher']
}

export function useCurrentUser(): SessionUser | null {
  const { data } = useApi<MeResponse>('/api/auth/me')
  return data ? { ...data.user, student: data.student, teacher: data.teacher } : null
}
