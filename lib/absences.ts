import { formatDate } from '@/lib/dates'
import { teacherRef } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'
import type { AbsenceView, Lesson } from '@/lib/types'

export async function uncoveredLessons(teacherId: string, from: Date, to: Date): Promise<Lesson[]> {
  if (from > to) {
    return []
  }
  const lessons = await expandLessons(prisma, { from, to, filter: { teacherId } })
  return lessons.filter((lesson) => lesson.substitution === null && lesson.teacher.id === teacherId)
}

export async function listAbsences(from: Date, to: Date): Promise<AbsenceView[]> {
  const absences = await prisma.teacherAbsence.findMany({
    where: { startDate: { lte: to }, endDate: { gte: from } },
    include: { teacher: { include: { user: true } } },
    orderBy: { startDate: 'asc' },
  })
  return Promise.all(
    absences.map(async (absence) => {
      const rangeStart = absence.startDate > from ? absence.startDate : from
      const rangeEnd = absence.endDate < to ? absence.endDate : to
      return {
        id: absence.id,
        teacher: teacherRef(absence.teacher),
        reason: absence.reason,
        startDate: formatDate(absence.startDate),
        endDate: formatDate(absence.endDate),
        uncoveredLessons: await uncoveredLessons(absence.teacherId, rangeStart, rangeEnd),
      }
    }),
  )
}
