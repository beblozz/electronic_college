import { resolveSemester } from '@/lib/journal/study-plan'
import type { DatabaseClient } from '@/lib/prisma'
import type { PlanTransferTarget } from '@/lib/types'

type Assignment = {
  groupId: string
  subjectId: string
  group: { name: string; courseYear: number }
  subject: { name: string }
}

async function assignments(db: DatabaseClient, subjectId: string, teacherId: string | null): Promise<Assignment[]> {
  const where = teacherId ? { teacherId } : { subjectId }
  const include = { group: true, subject: true } as const
  const [curricula, slots] = await Promise.all([
    db.curriculum.findMany({ where, include }),
    db.scheduleSlot.findMany({ where: { ...where, extraDate: null }, include, distinct: ['groupId', 'subjectId'] }),
  ])
  return [...curricula, ...slots]
}

export async function planTransferTargets(
  db: DatabaseClient,
  groupId: string,
  subjectId: string,
  teacherId: string | null,
): Promise<PlanTransferTarget[]> {
  const unique = new Map<string, Assignment>()
  for (const assignment of await assignments(db, subjectId, teacherId)) {
    const key = `${assignment.groupId}:${assignment.subjectId}`
    const isCurrent = assignment.groupId === groupId && assignment.subjectId === subjectId
    if (!isCurrent && !unique.has(key)) {
      unique.set(key, assignment)
    }
  }

  const targets: PlanTransferTarget[] = []
  for (const assignment of unique.values()) {
    const semester = await resolveSemester(db, assignment.groupId, assignment.subjectId)
    const plan = await db.studyPlan.findUnique({
      where: {
        groupId_subjectId_semester: { groupId: assignment.groupId, subjectId: assignment.subjectId, semester },
      },
      include: { _count: { select: { items: true } } },
    })
    targets.push({
      groupId: assignment.groupId,
      groupName: assignment.group.name,
      courseYear: assignment.group.courseYear,
      subjectId: assignment.subjectId,
      subjectName: assignment.subject.name,
      isSameSubject: assignment.subjectId === subjectId,
      planItemCount: plan?._count.items ?? 0,
    })
  }
  return targets.sort(
    (first, second) =>
      Number(second.isSameSubject) - Number(first.isSameSubject) ||
      first.subjectName.localeCompare(second.subjectName, 'ru') ||
      first.groupName.localeCompare(second.groupName, 'ru'),
  )
}
