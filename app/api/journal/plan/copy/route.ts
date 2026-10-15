import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherTeachesSubject } from '@/lib/access'
import { requireSession } from '@/lib/auth'
import { forbidden, notFound, parseBody, route } from '@/lib/http'
import { subjectLessonDates } from '@/lib/journal/plan-dates'
import { assertThresholds, maxPlanItems, planItemSchema, savePlan, thresholdSchema } from '@/lib/journal/plan-save'
import { spreadDate } from '@/lib/journal/plan-spread'
import { resolveSemester } from '@/lib/journal/study-plan'
import { prisma } from '@/lib/prisma'
import type { PlanCopyResult } from '@/lib/types'
import { idSchema } from '@/lib/validation/common'

const maxTargets = 20

const bodySchema = z.object({
  subjectId: idSchema,
  targetGroupIds: z.array(idSchema).min(1).max(maxTargets),
  withDates: z.boolean(),
  admissionThreshold: thresholdSchema,
  autoCreditThreshold: thresholdSchema,
  items: z.array(planItemSchema.omit({ id: true, plannedDate: true })).min(1).max(maxPlanItems),
})

export const POST = route(async (request) => {
  const session = await requireSession('TEACHER', 'ADMIN')
  const body = await parseBody(request, bodySchema)
  assertThresholds({ ...body, items: body.items.map((item) => ({ ...item, plannedDate: null })) })

  const groups = await prisma.group.findMany({ where: { id: { in: body.targetGroupIds } } })
  if (groups.length !== new Set(body.targetGroupIds).size) {
    throw notFound('Группа не найдена')
  }
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    for (const group of groups) {
      if (!teacher || !(await teacherTeachesSubject(prisma, teacher.id, group.id, body.subjectId))) {
        throw forbidden(`Вы не ведёте этот предмет у группы ${group.name}`)
      }
    }
  }

  const results: PlanCopyResult[] = []
  for (const group of groups) {
    const [semester, dates] = await Promise.all([
      resolveSemester(prisma, group.id, body.subjectId),
      body.withDates ? subjectLessonDates(prisma, group.id, body.subjectId) : Promise.resolve([]),
    ])
    const items = body.items.map((item, index) => ({
      ...item,
      plannedDate: spreadDate(dates, index, body.items.length),
    }))
    await prisma.$transaction((transaction) =>
      savePlan(transaction, {
        groupId: group.id,
        subjectId: body.subjectId,
        semester,
        admissionThreshold: body.admissionThreshold,
        autoCreditThreshold: body.autoCreditThreshold,
        items,
      }),
    )
    results.push({
      groupId: group.id,
      groupName: group.name,
      itemCount: items.length,
      datedCount: items.filter((item) => item.plannedDate).length,
    })
  }
  return NextResponse.json({ results })
})
