import type { Prisma } from '@prisma/client'
import { dayOfWeek, eachDate, formatDate } from '@/lib/dates'
import { teacherRef } from '@/lib/people'
import type { DatabaseClient } from '@/lib/prisma'
import { semesterForCourse, weekTypeForDate, weekTypesOverlap } from '@/lib/schedule/week-parity'
import type { Lesson } from '@/lib/types'

export type LessonFilter = {
  groupId?: string
  teacherId?: string
  roomId?: string
  scheduleSlotId?: string
}

type ExpandOptions = { from: Date; to: Date; filter?: LessonFilter }

function slotWhere(filter: LessonFilter, from: Date, to: Date): Prisma.ScheduleSlotWhereInput {
  const where: Prisma.ScheduleSlotWhereInput = {}
  if (filter.groupId) {
    where.groupId = filter.groupId
  }
  if (filter.roomId) {
    where.roomId = filter.roomId
  }
  if (filter.scheduleSlotId) {
    where.id = filter.scheduleSlotId
  }
  if (filter.teacherId) {
    where.OR = [
      { teacherId: filter.teacherId },
      { substitutions: { some: { substituteTeacherId: filter.teacherId, date: { gte: from, lte: to } } } },
    ]
  }
  return where
}

export async function expandLessons(db: DatabaseClient, options: ExpandOptions): Promise<Lesson[]> {
  const { from, to, filter = {} } = options
  const terms = await db.term.findMany({ where: { startDate: { lte: to }, endDate: { gte: from } } })
  if (terms.length === 0) {
    return []
  }

  const slots = await db.scheduleSlot.findMany({
    where: slotWhere(filter, from, to),
    include: {
      group: true,
      subject: true,
      room: true,
      teacher: { include: { user: true } },
      substitutions: {
        where: { date: { gte: from, lte: to } },
        include: {
          originalTeacher: { include: { user: true } },
          substituteTeacher: { include: { user: true } },
          subject: true,
          room: true,
          combinedWithSlot: { include: { group: true } },
        },
      },
    },
  })

  const lessons: Lesson[] = []
  for (const date of eachDate(from, to)) {
    const term = terms.find((candidate) => candidate.startDate <= date && candidate.endDate >= date)
    if (!term) {
      continue
    }
    const weekday = dayOfWeek(date)
    const weekType = weekTypeForDate(term.startDate, date)
    const dateKey = formatDate(date)

    for (const slot of slots) {
      const isActive =
        slot.dayOfWeek === weekday &&
        slot.semester === semesterForCourse(slot.group.courseYear, term.half) &&
        weekTypesOverlap(slot.weekType, weekType)
      if (!isActive) {
        continue
      }
      const substitution = slot.substitutions.find((candidate) => formatDate(candidate.date) === dateKey)
      const actualTeacher = substitution ? substitution.substituteTeacher : slot.teacher
      const actualSubject = substitution?.subject ?? slot.subject
      const actualRoom = substitution?.room ?? slot.room
      const involvesTeacher =
        !filter.teacherId || slot.teacherId === filter.teacherId || actualTeacher.id === filter.teacherId
      if (!involvesTeacher) {
        continue
      }
      lessons.push({
        scheduleSlotId: slot.id,
        date: dateKey,
        dayOfWeek: weekday,
        pairNumber: slot.pairNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: { id: actualSubject.id, name: actualSubject.name, code: actualSubject.code },
        group: { id: slot.group.id, name: slot.group.name },
        room: { id: actualRoom.id, number: actualRoom.number, building: actualRoom.building },
        teacher: teacherRef(actualTeacher),
        substitution: substitution
          ? {
              id: substitution.id,
              kind: substitution.kind,
              originalSubject: { id: slot.subject.id, name: slot.subject.name },
              combinedWithGroupName: substitution.combinedWithSlot?.group.name ?? null,
              originalTeacher: teacherRef(substitution.originalTeacher),
              substituteTeacher: teacherRef(substitution.substituteTeacher),
              reason: substitution.reason,
            }
          : null,
      })
    }
  }

  return lessons.sort(
    (first, second) =>
      first.date.localeCompare(second.date) ||
      first.pairNumber - second.pairNumber ||
      first.group.name.localeCompare(second.group.name, 'ru'),
  )
}

export async function findLesson(db: DatabaseClient, scheduleSlotId: string, date: Date): Promise<Lesson | null> {
  const lessons = await expandLessons(db, { from: date, to: date, filter: { scheduleSlotId } })
  return lessons[0] ?? null
}
