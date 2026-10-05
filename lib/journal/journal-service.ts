import type { Grade } from '@prisma/client'
import { formatDate } from '@/lib/dates'
import { notFound } from '@/lib/http'
import { fullName } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'
import type { GradeDto, Journal } from '@/lib/types'

export function serializeGrade(grade: Pick<Grade, 'id' | 'value' | 'date' | 'comment'>): GradeDto {
  return { id: grade.id, value: grade.value, date: formatDate(grade.date), comment: grade.comment }
}

export function averageOf(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sum = values.reduce((total, value) => total + value, 0)
  return Math.round((sum / values.length) * 100) / 100
}

export async function buildJournal(groupId: string, subjectId: string, from: Date, to: Date): Promise<Journal> {
  const [group, subject] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
  ])
  if (!group || !subject) {
    throw notFound('Группа или предмет не найдены')
  }

  const [students, groupLessons] = await Promise.all([
    prisma.student.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: {
        user: true,
        grades: { where: { subjectId, date: { gte: from, lte: to } }, orderBy: { date: 'asc' } },
        attendances: { where: { date: { gte: from, lte: to }, scheduleSlot: { groupId } } },
      },
      orderBy: { user: { lastName: 'asc' } },
    }),
    expandLessons(prisma, { from, to, filter: { groupId } }),
  ])

  const lessons = groupLessons
    .filter((lesson) => lesson.subject.id === subjectId)
    .map((lesson) => ({ date: lesson.date, scheduleSlotId: lesson.scheduleSlotId, pairNumber: lesson.pairNumber }))

  const dates = new Set(lessons.map((lesson) => lesson.date))
  for (const student of students) {
    for (const grade of student.grades) {
      dates.add(formatDate(grade.date))
    }
  }

  return {
    group: { id: group.id, name: group.name },
    subject: { id: subject.id, name: subject.name },
    from: formatDate(from),
    to: formatDate(to),
    lessons,
    dates: [...dates].sort(),
    students: students.map((student) => ({
      studentId: student.id,
      fullName: fullName(student.user),
      grades: student.grades.map(serializeGrade),
      attendance: student.attendances.map((attendance) => ({
        scheduleSlotId: attendance.scheduleSlotId,
        date: formatDate(attendance.date),
        status: attendance.status,
      })),
      averageGrade: averageOf(student.grades.map((grade) => grade.value)),
    })),
  }
}
