import type { PlanItemKind } from '@prisma/client'
import { badRequest } from '@/lib/http'
import { prisma } from '@/lib/prisma'

export type ResolvedPlanItem = { id: string; kind: PlanItemKind }

export async function assertPlanItem(planItemId: string | null, groupId: string, subjectId: string): Promise<string | null> {
  if (!planItemId) {
    return null
  }
  const item = await prisma.studyPlanItem.findFirst({ where: { id: planItemId, plan: { groupId, subjectId } } })
  if (!item) {
    throw badRequest('Работа не найдена в КТП этой группы')
  }
  return item.id
}

export async function planItemForDate(groupId: string, subjectId: string, date: Date): Promise<ResolvedPlanItem | null> {
  const item = await prisma.studyPlanItem.findFirst({
    where: { plannedDate: date, plan: { groupId, subjectId } },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  })
  return item ? { id: item.id, kind: item.kind } : null
}

export async function resolvePlanItem(
  planItemId: string | null | undefined,
  groupId: string,
  subjectId: string,
  date: Date,
): Promise<ResolvedPlanItem | null> {
  if (planItemId === undefined) {
    return planItemForDate(groupId, subjectId, date)
  }
  if (planItemId === null) {
    return null
  }
  const item = await prisma.studyPlanItem.findFirst({ where: { id: planItemId, plan: { groupId, subjectId } } })
  if (!item) {
    throw badRequest('Работа не найдена в КТП этой группы')
  }
  return { id: item.id, kind: item.kind }
}
