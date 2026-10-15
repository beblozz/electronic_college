import type { PlanItemKind } from '@prisma/client'
import { z } from 'zod'
import { parseDate } from '@/lib/dates'
import { badRequest } from '@/lib/http'
import { serializeStudyPlan, studyPlanInclude } from '@/lib/journal/study-plan'
import type { DatabaseClient } from '@/lib/prisma'
import type { StudyPlanDto } from '@/lib/types'
import { dateSchema, idSchema } from '@/lib/validation/common'

export const maxPlanItems = 60

export const planItemSchema = z.object({
  id: idSchema.optional(),
  kind: z.enum(['LECTURE', 'PRACTICAL', 'CREDIT']),
  title: z.string().trim().min(1).max(200),
  plannedDate: dateSchema.nullable(),
})

export const thresholdSchema = z.number().int().min(0).max(maxPlanItems).nullable()

type PlanItemInput = { id?: string; kind: PlanItemKind; title: string; plannedDate: string | null }

type SavePlanInput = {
  groupId: string
  subjectId: string
  semester: number
  admissionThreshold: number | null
  autoCreditThreshold: number | null
  items: PlanItemInput[]
}

export function assertThresholds(input: Pick<SavePlanInput, 'admissionThreshold' | 'autoCreditThreshold' | 'items'>): void {
  const workCount = input.items.filter((item) => item.kind !== 'CREDIT').length
  const thresholds = [input.admissionThreshold, input.autoCreditThreshold]
  if (thresholds.some((threshold) => threshold !== null && threshold > workCount)) {
    throw badRequest('Нельзя требовать больше работ, чем есть в КТП')
  }
  if (
    input.admissionThreshold !== null &&
    input.autoCreditThreshold !== null &&
    input.admissionThreshold > input.autoCreditThreshold
  ) {
    throw badRequest('Для допуска не может требоваться больше работ, чем для автомата')
  }
}

export async function savePlan(db: DatabaseClient, input: SavePlanInput): Promise<StudyPlanDto> {
  assertThresholds(input)
  const { groupId, subjectId, semester } = input
  const saved = await db.studyPlan.upsert({
    where: { groupId_subjectId_semester: { groupId, subjectId, semester } },
    create: {
      groupId,
      subjectId,
      semester,
      admissionThreshold: input.admissionThreshold,
      autoCreditThreshold: input.autoCreditThreshold,
    },
    update: { admissionThreshold: input.admissionThreshold, autoCreditThreshold: input.autoCreditThreshold },
  })
  const keptIds = input.items.flatMap((item) => (item.id ? [item.id] : []))
  await db.studyPlanItem.deleteMany({ where: { planId: saved.id, id: { notIn: keptIds } } })
  for (const [position, item] of input.items.entries()) {
    const data = {
      kind: item.kind,
      title: item.title,
      position,
      plannedDate: item.plannedDate ? parseDate(item.plannedDate) : null,
    }
    const existing = item.id ? await db.studyPlanItem.findFirst({ where: { id: item.id, planId: saved.id } }) : null
    if (existing) {
      await db.studyPlanItem.update({ where: { id: existing.id }, data })
    } else {
      await db.studyPlanItem.create({ data: { ...data, planId: saved.id } })
    }
  }
  const plan = await db.studyPlan.findUniqueOrThrow({ where: { id: saved.id }, include: studyPlanInclude })
  return serializeStudyPlan(plan, semester)
}
