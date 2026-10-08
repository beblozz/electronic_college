import type { Prisma } from '@prisma/client'
import { formatDate, parseDate, todayInTimeZone } from '@/lib/dates'
import { collegeTimeZone } from '@/lib/env'
import type { DatabaseClient } from '@/lib/prisma'
import { semesterForCourse } from '@/lib/schedule/week-parity'
import type { PlanProgress, PlanStatus, StudyPlanDto } from '@/lib/types'

export const passingGrade = 3

export const studyPlanInclude = {
  items: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
} satisfies Prisma.StudyPlanInclude

type StudyPlanRow = Prisma.StudyPlanGetPayload<{ include: typeof studyPlanInclude }>

export function collegeToday(): Date {
  return parseDate(todayInTimeZone(collegeTimeZone()))
}

export async function currentTerm(db: DatabaseClient) {
  const today = collegeToday()
  return db.term.findFirst({ where: { startDate: { lte: today }, endDate: { gte: today } } })
}

export async function resolveSemester(db: DatabaseClient, groupId: string, subjectId: string): Promise<number> {
  const [group, term, curriculum] = await Promise.all([
    db.group.findUniqueOrThrow({ where: { id: groupId } }),
    currentTerm(db),
    db.curriculum.findFirst({ where: { groupId, subjectId }, orderBy: { semester: 'desc' } }),
  ])
  if (term) {
    return semesterForCourse(group.courseYear, term.half)
  }
  return curriculum?.semester ?? semesterForCourse(group.courseYear, 1)
}

export function defaultAdmissionThreshold(total: number): number {
  return Math.floor(total / 2)
}

export function serializeStudyPlan(plan: StudyPlanRow | null, semester: number): StudyPlanDto {
  const items = (plan?.items ?? []).map((item) => ({
    id: item.id,
    kind: item.kind,
    title: item.title,
    position: item.position,
    plannedDate: item.plannedDate ? formatDate(item.plannedDate) : null,
  }))
  const total = items.length
  return {
    id: plan?.id ?? null,
    semester,
    items,
    admissionThreshold: Math.min(plan?.admissionThreshold ?? defaultAdmissionThreshold(total), total),
    autoCreditThreshold: Math.min(plan?.autoCreditThreshold ?? total, total),
    customAdmissionThreshold: plan?.admissionThreshold ?? null,
    customAutoCreditThreshold: plan?.autoCreditThreshold ?? null,
  }
}

export async function loadStudyPlan(
  db: DatabaseClient,
  groupId: string,
  subjectId: string,
  semester: number,
): Promise<StudyPlanDto> {
  const plan = await db.studyPlan.findUnique({
    where: { groupId_subjectId_semester: { groupId, subjectId, semester } },
    include: studyPlanInclude,
  })
  return serializeStudyPlan(plan, semester)
}

type PlanGrade = { planItemId: string | null; value: number }

export function planProgress(plan: StudyPlanDto, grades: PlanGrade[], today: Date): PlanProgress | null {
  const total = plan.items.length
  if (total === 0) {
    return null
  }
  const itemIds = new Set(plan.items.map((item) => item.id))
  const completedItemIds = [
    ...new Set(
      grades
        .filter((grade) => grade.planItemId && itemIds.has(grade.planItemId) && grade.value >= passingGrade)
        .map((grade) => grade.planItemId as string),
    ),
  ]
  const completed = completedItemIds.length
  const todayKey = formatDate(today)
  const owed = plan.items.filter(
    (item) => item.plannedDate && item.plannedDate <= todayKey && !completedItemIds.includes(item.id),
  ).length

  let status: PlanStatus = 'NOT_ADMITTED'
  if (completed >= plan.autoCreditThreshold) {
    status = 'AUTO_CREDIT'
  } else if (completed >= plan.admissionThreshold) {
    status = 'ADMITTED'
  }
  return {
    completed,
    total,
    owed,
    admissionThreshold: plan.admissionThreshold,
    autoCreditThreshold: plan.autoCreditThreshold,
    status,
    completedItemIds,
  }
}
