import type { PersonRef, UserSummary } from '@/lib/types'

type NamedUser = { firstName: string; lastName: string }

export function fullName(user: NamedUser): string {
  return `${user.lastName} ${user.firstName}`.trim()
}

export function teacherRef(teacher: { id: string; user: NamedUser }): PersonRef {
  return { id: teacher.id, fullName: fullName(teacher.user) }
}

export function userSummary(user: {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: UserSummary['role']
}): UserSummary {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
  }
}
