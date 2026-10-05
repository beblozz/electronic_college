import { formatDate } from '@/lib/dates'
import { fullName } from '@/lib/people'
import type { DatabaseClient } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'
import { weekTypesOverlap } from '@/lib/schedule/week-parity'
import type { ScheduleConflict, ScheduleSlotDto } from '@/lib/types'

type SlotCandidate = Omit<ScheduleSlotDto, 'id' | 'startTime' | 'endTime' | 'subjectId'>

export async function findSlotConflicts(
  db: DatabaseClient,
  candidate: SlotCandidate,
  excludedSlotId?: string,
): Promise<ScheduleConflict[]> {
  const neighbours = await db.scheduleSlot.findMany({
    where: {
      dayOfWeek: candidate.dayOfWeek,
      pairNumber: candidate.pairNumber,
      id: excludedSlotId ? { not: excludedSlotId } : undefined,
      OR: [{ teacherId: candidate.teacherId }, { roomId: candidate.roomId }, { groupId: candidate.groupId }],
    },
    include: { group: true, room: true, subject: true, teacher: { include: { user: true } } },
  })

  const conflicts: ScheduleConflict[] = []
  for (const neighbour of neighbours) {
    if (!weekTypesOverlap(neighbour.weekType, candidate.weekType)) {
      continue
    }
    const sharesTermHalf = neighbour.semester % 2 === candidate.semester % 2
    if (sharesTermHalf && neighbour.teacherId === candidate.teacherId) {
      conflicts.push({
        kind: 'TEACHER',
        scheduleSlotId: neighbour.id,
        message: `${fullName(neighbour.teacher.user)} уже ведёт «${neighbour.subject.name}» у группы ${neighbour.group.name}`,
      })
    }
    if (sharesTermHalf && neighbour.roomId === candidate.roomId) {
      conflicts.push({
        kind: 'ROOM',
        scheduleSlotId: neighbour.id,
        message: `Аудитория ${neighbour.room.number} занята группой ${neighbour.group.name}`,
      })
    }
    if (neighbour.semester === candidate.semester && neighbour.groupId === candidate.groupId) {
      conflicts.push({
        kind: 'GROUP',
        scheduleSlotId: neighbour.id,
        message: `У группы ${neighbour.group.name} в это время «${neighbour.subject.name}»`,
      })
    }
  }
  return conflicts
}

type SubstitutionTarget = { id: string; groupId: string; roomId: string; pairNumber: number }

export async function findSubstitutionConflicts(
  db: DatabaseClient,
  slot: SubstitutionTarget,
  date: Date,
  substituteTeacherId: string,
  combinedWithSlotId: string | null = null,
): Promise<ScheduleConflict[]> {
  const conflicts: ScheduleConflict[] = []

  const existing = await db.substitution.findUnique({
    where: { date_scheduleSlotId: { date, scheduleSlotId: slot.id } },
  })
  if (existing) {
    conflicts.push({
      kind: 'DUPLICATE',
      substitutionId: existing.id,
      message: `На ${formatDate(date)} замена для этой пары уже назначена`,
    })
  }

  const lessonsOfDay = await expandLessons(db, { from: date, to: date })
  const parallelLessons = lessonsOfDay.filter(
    (lesson) => lesson.pairNumber === slot.pairNumber && lesson.scheduleSlotId !== slot.id,
  )
  for (const lesson of parallelLessons) {
    const isJoinedLesson = lesson.scheduleSlotId === combinedWithSlotId
    if (isJoinedLesson) {
      continue
    }
    if (lesson.teacher.id === substituteTeacherId) {
      conflicts.push({
        kind: 'TEACHER',
        scheduleSlotId: lesson.scheduleSlotId,
        substitutionId: lesson.substitution?.id,
        message: `${lesson.teacher.fullName} в это время ведёт «${lesson.subject.name}» у группы ${lesson.group.name}`,
      })
    }
    if (!combinedWithSlotId && lesson.room.id === slot.roomId) {
      conflicts.push({
        kind: 'ROOM',
        scheduleSlotId: lesson.scheduleSlotId,
        message: `Аудитория ${lesson.room.number} занята группой ${lesson.group.name}`,
      })
    }
    if (lesson.group.id === slot.groupId) {
      conflicts.push({
        kind: 'GROUP',
        scheduleSlotId: lesson.scheduleSlotId,
        message: `У группы ${lesson.group.name} в это время «${lesson.subject.name}»`,
      })
    }
  }
  return conflicts
}
