import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherTeachesSubject } from '@/lib/access'
import { requireSession } from '@/lib/auth'
import { parseDate } from '@/lib/dates'
import { badRequest, forbidden, parseBody, route } from '@/lib/http'
import { resolveSemester, serializeStudyPlan, studyPlanInclude } from '@/lib/journal/study-plan'
import { prisma } from '@/lib/prisma'
import { dateSchema, idSchema } from '@/lib/validation/common'

const maxPlanItems = 60

const bodySchema = z
  .object({
    groupId: idSchema,
    subjectId: idSchema,
    admissionThreshold: z.number().int().min(0).max(maxPlanItems).nullable(),
    autoCreditThreshold: z.number().int().min(0).max(maxPlanItems).nullable(),
    items: z
      .array(
        z.object({
          id: idSchema.optional(),
          kind: z.enum(['LECTURE', 'PRACTICAL']),
          title: z.string().trim().min(1).max(200),
          plannedDate: dateSchema.nullable(),
        }),
      )
      .max(maxPlanItems),
  })
  .refine(
    (plan) =>
      plan.admissionThreshold === null ||
      plan.autoCreditThreshold === null ||
      plan.admissionThreshold <= plan.autoCreditThreshold,
    'Для допуска не может требоваться больше работ, чем для автомата',
  )

export const PUT = route(async (request) => {
  const session = await requireSession('TEACHER', 'ADMIN')
  const body = await parseBody(request, bodySchema)
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher || !(await teacherTeachesSubject(prisma, teacher.id, body.groupId, body.subjectId))) {
      throw forbidden('КТП может вести только преподаватель предмета')
    }
  }
  const thresholds = [body.admissionThreshold, body.autoCreditThreshold]
  if (thresholds.some((threshold) => threshold !== null && threshold > body.items.length)) {
    throw badRequest('Нельзя требовать больше работ, чем есть в КТП')
  }

  const semester = await resolveSemester(prisma, body.groupId, body.subjectId)
  const plan = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.studyPlan.upsert({
      where: { groupId_subjectId_semester: { groupId: body.groupId, subjectId: body.subjectId, semester } },
      create: {
        groupId: body.groupId,
        subjectId: body.subjectId,
        semester,
        admissionThreshold: body.admissionThreshold,
        autoCreditThreshold: body.autoCreditThreshold,
      },
      update: { admissionThreshold: body.admissionThreshold, autoCreditThreshold: body.autoCreditThreshold },
    })
    const keptIds = body.items.flatMap((item) => (item.id ? [item.id] : []))
    await transaction.studyPlanItem.deleteMany({ where: { planId: saved.id, id: { notIn: keptIds } } })
    for (const [position, item] of body.items.entries()) {
      const data = {
        kind: item.kind,
        title: item.title,
        position,
        plannedDate: item.plannedDate ? parseDate(item.plannedDate) : null,
      }
      const existing = item.id
        ? await transaction.studyPlanItem.findFirst({ where: { id: item.id, planId: saved.id } })
        : null
      if (existing) {
        await transaction.studyPlanItem.update({ where: { id: existing.id }, data })
      } else {
        await transaction.studyPlanItem.create({ data: { ...data, planId: saved.id } })
      }
    }
    return transaction.studyPlan.findUniqueOrThrow({ where: { id: saved.id }, include: studyPlanInclude })
  })

  return NextResponse.json({ plan: serializeStudyPlan(plan, semester) })
})
