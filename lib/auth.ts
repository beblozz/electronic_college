import type { Student, Teacher } from '@prisma/client'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import { forbidden, unauthenticated } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import {
  Session,
  sessionCookieName,
  sessionMaxAgeSeconds,
  signSessionToken,
  verifySessionToken,
} from '@/lib/session-token'
import type { Role, SessionUser } from '@/lib/types'

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  return verifySessionToken(cookieStore.get(sessionCookieName)?.value)
}

export async function requireSession(...roles: Role[]): Promise<Session> {
  const session = await getSession()
  if (!session) {
    throw unauthenticated()
  }
  if (roles.length > 0 && !roles.includes(session.role)) {
    throw forbidden()
  }
  return session
}

export async function requireStudent(): Promise<{ session: Session; student: Student }> {
  const session = await requireSession('STUDENT')
  const student = await prisma.student.findUnique({ where: { userId: session.userId } })
  if (!student) {
    throw forbidden('Профиль студента не найден')
  }
  return { session, student }
}

export async function requireTeacher(): Promise<{ session: Session; teacher: Teacher }> {
  const session = await requireSession('TEACHER')
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  if (!teacher) {
    throw forbidden('Профиль преподавателя не найден')
  }
  return { session, teacher }
}

export async function attachSessionCookie(response: NextResponse, session: Session): Promise<void> {
  response.cookies.set(sessionCookieName, await signSessionToken(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionMaxAgeSeconds,
  })
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(sessionCookieName, '', { httpOnly: true, path: '/', maxAge: 0 })
}

export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { student: { include: { group: true } }, teacher: true },
  })
  if (!user) {
    return null
  }
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    student: user.student
      ? { id: user.student.id, groupId: user.student.groupId, groupName: user.student.group.name }
      : null,
    teacher: user.teacher
      ? { id: user.teacher.id, departmentId: user.teacher.departmentId, status: user.teacher.status }
      : null,
  }
}
