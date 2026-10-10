import type { Prisma } from '@prisma/client'
import { formatDate } from '@/lib/dates'
import { badRequest, notFound } from '@/lib/http'
import { fullName } from '@/lib/people'
import type { DatabaseClient } from '@/lib/prisma'
import { subjectBalances } from '@/lib/hours/program-hours'
import { expandLessons, findLesson } from '@/lib/schedule/expand-lessons'
import {
  collectTeacherPairs,
  consecutiveRunLength,
  countWeeklyPairs,
  hoursPerPair,
  TeacherPairs,
  weekRange,
} from '@/lib/schedule/teacher-load'
import type {
  CombinedCandidate,
  OtherSubjectCandidate,
  SubstitutionCandidate,
  SubstitutionSuggestions,
} from '@/lib/types'

export const defaultMaxConsecutivePairs = 4

type SuggestOptions = { scheduleSlotId: string; date: Date; maxConsecutivePairs?: number }

type TeacherWithUser = Prisma.TeacherGetPayload<{ include: { user: true } }>

type LoadContext = {
  dateKey: string
  pairNumber: number
  maxConsecutivePairs: number
  pairsByTeacher: TeacherPairs
}

function evaluateTeacher(teacher: TeacherWithUser, context: LoadContext, role: string): SubstitutionCandidate | null {
  const pairsByDate = context.pairsByTeacher.get(teacher.id)
  const pairsToday = pairsByDate?.get(context.dateKey) ?? []
  const weeklyHours = countWeeklyPairs(pairsByDate) * hoursPerPair

  const isBusy = pairsToday.includes(context.pairNumber)
  const exceedsConsecutiveLimit =
    consecutiveRunLength(pairsToday, context.pairNumber) > context.maxConsecutivePairs
  const exceedsWeeklyLimit = weeklyHours + hoursPerPair > teacher.maxHoursPerWeek
  if (isBusy || exceedsConsecutiveLimit || exceedsWeeklyLimit) {
    return null
  }
  return {
    teacherId: teacher.id,
    fullName: fullName(teacher.user),
    currentLoadToday: pairsToday.length,
    weeklyLoad: weeklyHours,
    maxHoursPerWeek: teacher.maxHoursPerWeek,
    reason: `${role}, пар в этот день: ${pairsToday.length}, ${weeklyHours} из ${teacher.maxHoursPerWeek} часов в неделю`,
  }
}

function byLoad(first: SubstitutionCandidate, second: SubstitutionCandidate): number {
  return (
    first.currentLoadToday - second.currentLoadToday ||
    first.weeklyLoad - second.weeklyLoad ||
    first.fullName.localeCompare(second.fullName, 'ru')
  )
}

export async function suggestCandidates(db: DatabaseClient, options: SuggestOptions): Promise<SubstitutionSuggestions> {
  const { scheduleSlotId, date, maxConsecutivePairs = defaultMaxConsecutivePairs } = options
  const slot = await db.scheduleSlot.findUnique({ where: { id: scheduleSlotId } })
  if (!slot) {
    throw notFound('Пара не найдена')
  }
  const lesson = await findLesson(db, scheduleSlotId, date)
  if (!lesson) {
    throw badRequest('В эту дату пара не проводится')
  }

  const dateKey = formatDate(date)
  const { weekStart, weekEnd } = weekRange(dateKey)
  const availableTeacher: Prisma.TeacherWhereInput = {
    id: { not: slot.teacherId },
    status: { not: 'FIRED' },
    absences: { none: { startDate: { lte: date }, endDate: { gte: date } } },
  }

  const term = await db.term.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } } })
  const [sameSubjectTeachers, curricula, pairsByTeacher, lessonsOfDay, balances] = await Promise.all([
    db.teacher.findMany({
      where: { ...availableTeacher, teacherSubjects: { some: { subjectId: slot.subjectId } } },
      include: { user: true },
    }),
    db.curriculum.findMany({
      where: { groupId: slot.groupId, semester: slot.semester, teacher: availableTeacher },
      include: { subject: true, teacher: { include: { user: true } } },
    }),
    collectTeacherPairs(db, weekStart, weekEnd),
    expandLessons(db, { from: date, to: date }),
    subjectBalances(db, term, slot.groupId),
  ])

  const context: LoadContext = { dateKey, pairNumber: slot.pairNumber, maxConsecutivePairs, pairsByTeacher }

  const candidates = sameSubjectTeachers
    .flatMap((teacher) => evaluateTeacher(teacher, context, 'Ведёт этот предмет') ?? [])
    .sort(byLoad)

  const otherSubjectCandidates: OtherSubjectCandidate[] = curricula
    .filter((curriculum) => curriculum.subjectId !== slot.subjectId)
    .flatMap((curriculum) => {
      const candidate = evaluateTeacher(curriculum.teacher, context, 'Ведёт у группы свой предмет')
      return candidate
        ? [
            {
              ...candidate,
              subject: { id: curriculum.subject.id, name: curriculum.subject.name },
              subjectBalancePairs: balances.get(curriculum.subjectId) ?? null,
            },
          ]
        : []
    })
    .sort(
      (first, second) =>
        (first.subjectBalancePairs ?? 0) - (second.subjectBalancePairs ?? 0) || byLoad(first, second),
    )

  const combinedCandidates = await findCombinedCandidates(db, {
    slot,
    parallelLessons: lessonsOfDay.filter(
      (other) => other.pairNumber === slot.pairNumber && other.scheduleSlotId !== slot.id,
    ),
    curriculumSubjectIds: new Set([slot.subjectId, ...curricula.map((curriculum) => curriculum.subjectId)]),
    date,
  })

  return {
    slot: lesson,
    slotSubjectBalancePairs: balances.get(slot.subjectId) ?? null,
    candidates,
    otherSubjectCandidates,
    combinedCandidates,
  }
}

type CombinedOptions = {
  slot: { id: string; groupId: string; subjectId: string; teacherId: string }
  parallelLessons: SubstitutionSuggestions['slot'][]
  curriculumSubjectIds: Set<string>
  date: Date
}

async function findCombinedCandidates(db: DatabaseClient, options: CombinedOptions): Promise<CombinedCandidate[]> {
  const { slot, parallelLessons, curriculumSubjectIds, date } = options
  const suitableLessons = parallelLessons.filter(
    (lesson) =>
      lesson.teacher.id !== slot.teacherId &&
      lesson.group.id !== slot.groupId &&
      curriculumSubjectIds.has(lesson.subject.id),
  )
  if (suitableLessons.length === 0) {
    return []
  }

  const groupIds = [slot.groupId, ...suitableLessons.map((lesson) => lesson.group.id)]
  const [rooms, studentCounts, absentTeachers] = await Promise.all([
    db.room.findMany({ where: { id: { in: suitableLessons.map((lesson) => lesson.room.id) } } }),
    db.student.groupBy({
      by: ['groupId'],
      where: { groupId: { in: groupIds }, status: 'ACTIVE' },
      _count: { _all: true },
    }),
    db.teacherAbsence.findMany({
      where: { startDate: { lte: date }, endDate: { gte: date } },
      select: { teacherId: true },
    }),
  ])
  const capacityByRoom = new Map(rooms.map((room) => [room.id, room.capacity]))
  const studentsByGroup = new Map(studentCounts.map((item) => [item.groupId, item._count._all]))
  const absentTeacherIds = new Set(absentTeachers.map((absence) => absence.teacherId))
  const ownStudentCount = studentsByGroup.get(slot.groupId) ?? 0

  return suitableLessons
    .filter((lesson) => !absentTeacherIds.has(lesson.teacher.id))
    .map((lesson) => {
      const capacity = capacityByRoom.get(lesson.room.id) ?? 0
      const studentCount = ownStudentCount + (studentsByGroup.get(lesson.group.id) ?? 0)
      return {
        scheduleSlotId: lesson.scheduleSlotId,
        teacherId: lesson.teacher.id,
        fullName: lesson.teacher.fullName,
        subject: { id: lesson.subject.id, name: lesson.subject.name },
        group: lesson.group,
        room: { id: lesson.room.id, number: lesson.room.number, capacity },
        studentCount,
        fitsRoom: studentCount <= capacity,
        isSameSubject: lesson.subject.id === slot.subjectId,
      }
    })
    .sort(
      (first, second) =>
        Number(second.isSameSubject) - Number(first.isSameSubject) ||
        Number(second.fitsRoom) - Number(first.fitsRoom) ||
        first.fullName.localeCompare(second.fullName, 'ru'),
    )
}
