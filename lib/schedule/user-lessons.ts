import { prisma } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'
import type { Lesson } from '@/lib/types'

export async function lessonsForUser(userId: string, from: Date, to: Date): Promise<Lesson[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { student: true, teacher: true } })
  if (user?.student) {
    return expandLessons(prisma, { from, to, filter: { groupId: user.student.groupId } })
  }
  if (user?.teacher) {
    const teacherId = user.teacher.id
    const lessons = await expandLessons(prisma, { from, to, filter: { teacherId } })
    return lessons.filter((lesson) => lesson.teacher.id === teacherId)
  }
  return []
}

export async function currentTermRange(today: Date): Promise<{ from: Date; to: Date } | null> {
  const term =
    (await prisma.term.findFirst({ where: { startDate: { lte: today }, endDate: { gte: today } } })) ??
    (await prisma.term.findFirst({ where: { startDate: { gt: today } }, orderBy: { startDate: 'asc' } }))
  return term ? { from: term.startDate, to: term.endDate } : null
}
