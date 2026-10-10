import type { Term } from '@prisma/client'
import { formatDate } from '@/lib/dates'
import { collegeToday } from '@/lib/journal/study-plan'
import { teacherRef } from '@/lib/people'
import type { DatabaseClient } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'
import { hoursPerPair } from '@/lib/schedule/teacher-load'
import { semesterForCourse } from '@/lib/schedule/week-parity'
import type { HoursStatus, Lesson, PersonRef, ProgramHoursReport, SubjectHours, TeacherHours } from '@/lib/types'

type ReportOptions = { term: Term | null; groupId?: string; subjectId?: string; teacherId?: string }

type AccountedLesson = Lesson & {
  gridSubjectId: string
  gridSubjectName: string
  gridTeacher: PersonRef
  isHeld: boolean
  isPast: boolean
}

type SubjectAccumulator = {
  group: { id: string; name: string }
  subject: { id: string; name: string }
  gridTotalPairs: number
  scheduledPairsToDate: number
  conductedPairsToDate: number
  missedPairsToDate: number
  givenAwayPairsToDate: number
  receivedPairsToDate: number
  forecastPairs: number
  heldDates: string[]
}

function emptySubject(group: { id: string; name: string }, subject: { id: string; name: string }): SubjectAccumulator {
  return {
    group,
    subject,
    gridTotalPairs: 0,
    scheduledPairsToDate: 0,
    conductedPairsToDate: 0,
    missedPairsToDate: 0,
    givenAwayPairsToDate: 0,
    receivedPairsToDate: 0,
    forecastPairs: 0,
    heldDates: [],
  }
}

function statusFor(balanceHours: number): HoursStatus {
  if (balanceHours > 0) {
    return 'AHEAD'
  }
  return balanceHours < 0 ? 'BEHIND' : 'ON_TRACK'
}

async function accountLessons(db: DatabaseClient, term: Term, groupId?: string): Promise<AccountedLesson[]> {
  const [lessons, absences] = await Promise.all([
    expandLessons(db, { from: term.startDate, to: term.endDate, filter: groupId ? { groupId } : {} }),
    db.teacherAbsence.findMany({ where: { startDate: { lte: term.endDate }, endDate: { gte: term.startDate } } }),
  ])
  const todayKey = formatDate(collegeToday())
  const isAbsent = (teacherId: string, date: string) =>
    absences.some(
      (absence) =>
        absence.teacherId === teacherId &&
        formatDate(absence.startDate) <= date &&
        formatDate(absence.endDate) >= date,
    )

  return lessons.map((lesson) => {
    const gridTeacher = lesson.substitution?.originalTeacher ?? lesson.teacher
    const gridSubject = lesson.substitution?.originalSubject ?? lesson.subject
    return {
      ...lesson,
      gridSubjectId: gridSubject.id,
      gridSubjectName: gridSubject.name,
      gridTeacher,
      isHeld: lesson.substitution !== null || !isAbsent(lesson.teacher.id, lesson.date),
      isPast: lesson.date <= todayKey,
    }
  })
}

export async function buildProgramHoursReport(db: DatabaseClient, options: ReportOptions): Promise<ProgramHoursReport> {
  const today = formatDate(collegeToday())
  const { term } = options
  if (!term) {
    return { term: null, today, subjects: [], teachers: [] }
  }

  const lessons = await accountLessons(db, term, options.groupId)
  const subjects = new Map<string, SubjectAccumulator>()
  const subjectEntry = (group: { id: string; name: string }, subject: { id: string; name: string }) => {
    const key = `${group.id}:${subject.id}`
    const entry = subjects.get(key) ?? emptySubject(group, subject)
    subjects.set(key, entry)
    return entry
  }

  const teachers = new Map<string, TeacherHours>()
  const teacherEntry = (teacher: PersonRef) => {
    const entry = teachers.get(teacher.id) ?? {
      teacher,
      scheduledHoursToDate: 0,
      conductedHoursToDate: 0,
      balanceHoursToDate: 0,
      takenPairsToDate: 0,
      givenAwayPairsToDate: 0,
      missedPairsToDate: 0,
    }
    teachers.set(teacher.id, entry)
    return entry
  }

  for (const lesson of lessons) {
    const grid = subjectEntry(lesson.group, { id: lesson.gridSubjectId, name: lesson.gridSubjectName })
    const actual = subjectEntry(lesson.group, { id: lesson.subject.id, name: lesson.subject.name })
    const isSubjectChanged = lesson.gridSubjectId !== lesson.subject.id
    grid.gridTotalPairs += 1
    if (lesson.isHeld) {
      actual.forecastPairs += 1
      actual.heldDates.push(lesson.date)
    }

    if (lesson.isPast) {
      grid.scheduledPairsToDate += 1
      if (!lesson.isHeld) {
        grid.missedPairsToDate += 1
      } else {
        actual.conductedPairsToDate += 1
        if (isSubjectChanged) {
          grid.givenAwayPairsToDate += 1
          actual.receivedPairsToDate += 1
        }
      }

      const gridTeacher = teacherEntry(lesson.gridTeacher)
      gridTeacher.scheduledHoursToDate += hoursPerPair
      if (!lesson.isHeld) {
        gridTeacher.missedPairsToDate += 1
      } else {
        teacherEntry(lesson.teacher).conductedHoursToDate += hoursPerPair
        if (lesson.teacher.id !== lesson.gridTeacher.id) {
          gridTeacher.givenAwayPairsToDate += 1
          teacherEntry(lesson.teacher).takenPairsToDate += 1
        }
      }
    }
  }

  const groupIds = [...new Set([...subjects.values()].map((entry) => entry.group.id))]
  const curricula = await db.curriculum.findMany({
    where: { groupId: { in: groupIds } },
    include: { group: true, teacher: { include: { user: true } } },
  })
  const curriculumFor = (groupId: string, subjectId: string) =>
    curricula.find(
      (curriculum) =>
        curriculum.groupId === groupId &&
        curriculum.subjectId === subjectId &&
        curriculum.semester === semesterForCourse(curriculum.group.courseYear, term.half),
    )

  const subjectRows: SubjectHours[] = [...subjects.values()]
    .filter((entry) => !options.subjectId || entry.subject.id === options.subjectId)
    .map((entry) => {
      const curriculum = curriculumFor(entry.group.id, entry.subject.id)
      const plannedHours = curriculum?.plannedHours ?? entry.gridTotalPairs * hoursPerPair
      const forecastHours = entry.forecastPairs * hoursPerPair
      const plannedPairs = Math.ceil(plannedHours / hoursPerPair)
      const sortedDates = [...entry.heldDates].sort()
      const completionDate = plannedPairs > 0 && sortedDates.length >= plannedPairs ? sortedDates[plannedPairs - 1] : null
      return {
        group: entry.group,
        subject: entry.subject,
        teacher: curriculum ? teacherRef(curriculum.teacher) : null,
        plannedHours,
        plannedSource: curriculum?.plannedHours ? 'CURRICULUM' : 'SCHEDULE',
        scheduledHoursToDate: entry.scheduledPairsToDate * hoursPerPair,
        conductedHoursToDate: entry.conductedPairsToDate * hoursPerPair,
        balancePairsToDate: entry.conductedPairsToDate - entry.scheduledPairsToDate,
        missedPairsToDate: entry.missedPairsToDate,
        givenAwayPairsToDate: entry.givenAwayPairsToDate,
        receivedPairsToDate: entry.receivedPairsToDate,
        forecastHours,
        forecastBalanceHours: forecastHours - plannedHours,
        completionDate,
        extraPairsAfterCompletion: Math.max(entry.forecastPairs - plannedPairs, 0),
        status: statusFor(forecastHours - plannedHours),
      } satisfies SubjectHours
    })
    .filter((row) => !options.teacherId || row.teacher?.id === options.teacherId || lessons.some(
      (lesson) => lesson.group.id === row.group.id && lesson.gridSubjectId === row.subject.id && lesson.gridTeacher.id === options.teacherId,
    ))
    .sort(
      (first, second) =>
        first.group.name.localeCompare(second.group.name, 'ru') ||
        first.subject.name.localeCompare(second.subject.name, 'ru'),
    )

  const teacherRows = [...teachers.values()]
    .map((entry) => ({ ...entry, balanceHoursToDate: entry.conductedHoursToDate - entry.scheduledHoursToDate }))
    .filter((entry) => !options.teacherId || entry.teacher.id === options.teacherId)
    .sort((first, second) => first.teacher.fullName.localeCompare(second.teacher.fullName, 'ru'))

  return {
    term: { id: term.id, name: term.name, startDate: formatDate(term.startDate), endDate: formatDate(term.endDate) },
    today,
    subjects: subjectRows,
    teachers: teacherRows,
  }
}

export async function subjectHoursFor(
  db: DatabaseClient,
  term: Term | null,
  groupId: string,
  subjectId: string,
): Promise<SubjectHours | null> {
  const report = await buildProgramHoursReport(db, { term, groupId, subjectId })
  return report.subjects[0] ?? null
}

export async function subjectBalances(db: DatabaseClient, term: Term | null, groupId: string): Promise<Map<string, number>> {
  const report = await buildProgramHoursReport(db, { term, groupId })
  return new Map(report.subjects.map((row) => [row.subject.id, row.balancePairsToDate]))
}

