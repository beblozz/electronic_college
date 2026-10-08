import type { Prisma } from '@prisma/client'
import { formatDate } from '@/lib/dates'
import { notFound } from '@/lib/http'
import { buildInsight, median } from '@/lib/journal/insights'
import { collegeToday, loadStudyPlan, planProgress, resolveSemester } from '@/lib/journal/study-plan'
import { fullName, teacherRef } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'
import type { GradeDto, Journal, JournalScope, PersonRef } from '@/lib/types'

export const gradeInclude = { teacher: { include: { user: true } } } as const

type GradeRow = Prisma.GradeGetPayload<{ include: typeof gradeInclude }>

export function serializeGrade(grade: GradeRow): GradeDto {
  return {
    id: grade.id,
    value: grade.value,
    date: formatDate(grade.date),
    comment: grade.comment,
    kind: grade.kind,
    planItemId: grade.planItemId,
    teacher: teacherRef(grade.teacher),
  }
}

export function averageOf(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sum = values.reduce((total, value) => total + value, 0)
  return Math.round((sum / values.length) * 100) / 100
}

type JournalOptions = {
  groupId: string
  subjectId: string
  from: Date
  to: Date
  scope: JournalScope
  viewerTeacherId: string | null
  canEditPlan: boolean
}

export async function buildJournal(options: JournalOptions): Promise<Journal> {
  const { groupId, subjectId, from, to, viewerTeacherId } = options
  const scope: JournalScope = viewerTeacherId ? options.scope : 'all'
  const [group, subject] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
  ])
  if (!group || !subject) {
    throw notFound('Группа или предмет не найдены')
  }

  const semester = await resolveSemester(prisma, groupId, subjectId)
  const [students, groupLessons, plan, curriculum] = await Promise.all([
    prisma.student.findMany({
      where: { groupId, status: 'ACTIVE' },
      include: {
        user: true,
        grades: { where: { subjectId }, include: gradeInclude, orderBy: [{ date: 'asc' }, { id: 'asc' }] },
        attendances: { where: { date: { gte: from, lte: to }, scheduleSlot: { groupId } } },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    }),
    expandLessons(prisma, { from, to, filter: { groupId } }),
    loadStudyPlan(prisma, groupId, subjectId, semester),
    prisma.curriculum.findFirst({
      where: { groupId, subjectId },
      include: { teacher: { include: { user: true } } },
      orderBy: { semester: 'desc' },
    }),
  ])

  const subjectLessons = groupLessons.filter((lesson) => lesson.subject.id === subjectId)
  const visibleLessons =
    scope === 'mine' ? subjectLessons.filter((lesson) => lesson.teacher.id === viewerTeacherId) : subjectLessons
  const isGradeVisible = (grade: GradeRow) =>
    grade.date >= from && grade.date <= to && (scope === 'all' || grade.teacherId === viewerTeacherId)

  const teachersById = new Map<string, PersonRef>()
  if (curriculum) {
    teachersById.set(curriculum.teacherId, teacherRef(curriculum.teacher))
  }
  for (const lesson of subjectLessons) {
    teachersById.set(lesson.teacher.id, lesson.teacher)
  }
  for (const student of students) {
    for (const grade of student.grades) {
      teachersById.set(grade.teacherId, teacherRef(grade.teacher))
    }
  }

  const lessons = visibleLessons.map((lesson) => ({
    date: lesson.date,
    scheduleSlotId: lesson.scheduleSlotId,
    pairNumber: lesson.pairNumber,
    teacher: lesson.teacher,
  }))
  const todayKey = formatDate(collegeToday())
  const heldLessonKeys = new Set(
    lessons.filter((lesson) => lesson.date <= todayKey).map((lesson) => `${lesson.scheduleSlotId}:${lesson.date}`),
  )

  const visibleGradesByStudent = new Map(
    students.map((student) => [student.id, student.grades.filter(isGradeVisible)]),
  )
  const medianGradeCount = median([...visibleGradesByStudent.values()].map((grades) => grades.length))
  const allVisibleValues = [...visibleGradesByStudent.values()].flat().map((grade) => grade.value)

  const dates = new Set(lessons.map((lesson) => lesson.date))
  for (const grades of visibleGradesByStudent.values()) {
    for (const grade of grades) {
      dates.add(formatDate(grade.date))
    }
  }

  const today = collegeToday()
  return {
    group: { id: group.id, name: group.name },
    subject: { id: subject.id, name: subject.name },
    from: formatDate(from),
    to: formatDate(to),
    lessons,
    dates: [...dates].sort(),
    scope,
    teachers: [...teachersById.values()].sort((first, second) => first.fullName.localeCompare(second.fullName, 'ru')),
    viewerTeacherId,
    canEditPlan: options.canEditPlan,
    plan,
    stats: { medianGradeCount, averageGrade: averageOf(allVisibleValues) },
    students: students.map((student) => {
      const grades = visibleGradesByStudent.get(student.id) ?? []
      const averageGrade = averageOf(grades.map((grade) => grade.value))
      const absences = student.attendances.filter(
        (attendance) =>
          attendance.status === 'ABSENT' &&
          heldLessonKeys.has(`${attendance.scheduleSlotId}:${formatDate(attendance.date)}`),
      ).length
      const progress = planProgress(plan, student.grades, today)
      return {
        studentId: student.id,
        fullName: fullName(student.user),
        grades: grades.map(serializeGrade),
        attendance: student.attendances.map((attendance) => ({
          scheduleSlotId: attendance.scheduleSlotId,
          date: formatDate(attendance.date),
          status: attendance.status,
        })),
        averageGrade,
        plan: progress,
        insight: buildInsight({
          gradeCount: grades.length,
          averageGrade,
          absences,
          lessonsHeld: heldLessonKeys.size,
          plan: progress,
          medianGradeCount,
        }),
      }
    }),
  }
}
