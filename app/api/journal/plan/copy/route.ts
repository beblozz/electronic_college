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
  targets: z.array(z.object({ groupId: idSchema, subjectId: idSchema })).min(1).max(maxTargets),
  withDates: z.boolean(),
  admissionThreshold: thresholdSchema,
  autoCreditThreshold: thresholdSchema,
  items: z.array(planItemSchema.omit({ id: true, plannedDate: true })).min(1).max(maxPlanItems),
})

export const POST = route(async (request) => {
  const session = await requireSession('TEACHER', 'ADMIN')
  const body = await parseBody(request, bodySchema)
  assertThresholds({ ...body, items: body.items.map((item) => ({ ...item, plannedDate: null })) })

  const teacher =
    session.role === 'TEACHER' ? await prisma.teacher.findUnique({ where: { userId: session.userId } }) : null
  const resolved = []
  for (const target of body.targets) {
    const [group, subject] = await Promise.all([
      prisma.group.findUnique({ where: { id: target.groupId } }),
      prisma.subject.findUnique({ where: { id: target.subjectId } }),
    ])
    if (!group || !subject) {
      throw notFound('Группа или предмет не найдены')
    }
    if (session.role === 'TEACHER') {
      if (!teacher || !(await teacherTeachesSubject(prisma, teacher.id, group.id, subject.id))) {
        throw forbidden(`Вы не ведёте «${subject.name}» у группы ${group.name}`)
      }
    }
    resolved.push({ group, subject })
  }

  const results: PlanCopyResult[] = []
  for (const { group, subject } of resolved) {
    const [semester, dates] = await Promise.all([
      resolveSemester(prisma, group.id, subject.id),
      body.withDates ? subjectLessonDates(prisma, group.id, subject.id) : Promise.resolve([]),
    ])
    const items = body.items.map((item, index) => ({
      ...item,
      plannedDate: spreadDate(dates, index, body.items.length),
    }))
    await prisma.$transaction((transaction) =>
      savePlan(transaction, {
        groupId: group.id,
        subjectId: subject.id,
        semester,
        admissionThreshold: body.admissionThreshold,
        autoCreditThreshold: body.autoCreditThreshold,
        items,
      }),
    )
    results.push({
      groupId: group.id,
      groupName: group.name,
      subjectName: subject.name,
      itemCount: items.length,
      datedCount: items.filter((item) => item.plannedDate).length,
    })
  }
  return NextResponse.json({ results })
})
