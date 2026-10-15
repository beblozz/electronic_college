import { teacherTeachesSubject } from '@/lib/access'
import { resolveSemester } from '@/lib/journal/study-plan'
import type { DatabaseClient } from '@/lib/prisma'
import type { ParallelGroup } from '@/lib/types'

export async function parallelGroups(
  db: DatabaseClient,
  groupId: string,
  subjectId: string,
  teacherId: string | null,
): Promise<ParallelGroup[]> {
  const source = await db.group.findUniqueOrThrow({ where: { id: groupId } })
  const candidates = await db.group.findMany({
    where: {
      id: { not: groupId },
      courseYear: source.courseYear,
      OR: [{ curricula: { some: { subjectId } } }, { scheduleSlots: { some: { subjectId, extraDate: null } } }],
    },
    orderBy: { name: 'asc' },
  })
  const result: ParallelGroup[] = []
  for (const group of candidates) {
    if (teacherId && !(await teacherTeachesSubject(db, teacherId, group.id, subjectId))) {
      continue
    }
    const semester = await resolveSemester(db, group.id, subjectId)
    const plan = await db.studyPlan.findUnique({
      where: { groupId_subjectId_semester: { groupId: group.id, subjectId, semester } },
      include: { _count: { select: { items: true } } },
    })
    result.push({ id: group.id, name: group.name, planItemCount: plan?._count.items ?? 0 })
  }
  return result
}
