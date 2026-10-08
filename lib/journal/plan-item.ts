import { badRequest } from '@/lib/http'
import { prisma } from '@/lib/prisma'

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
