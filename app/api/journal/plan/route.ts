import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherTeachesSubject } from '@/lib/access'
import { requireSession } from '@/lib/auth'
import { forbidden, parseBody, route } from '@/lib/http'
import { maxPlanItems, planItemSchema, savePlan, thresholdSchema } from '@/lib/journal/plan-save'
import { resolveSemester } from '@/lib/journal/study-plan'
import { prisma } from '@/lib/prisma'
import { idSchema } from '@/lib/validation/common'

const bodySchema = z.object({
  groupId: idSchema,
  subjectId: idSchema,
  admissionThreshold: thresholdSchema,
  autoCreditThreshold: thresholdSchema,
  items: z.array(planItemSchema).max(maxPlanItems),
})

export const PUT = route(async (request) => {
  const session = await requireSession('TEACHER', 'ADMIN')
  const body = await parseBody(request, bodySchema)
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher || !(await teacherTeachesSubject(prisma, teacher.id, body.groupId, body.subjectId))) {
      throw forbidden('КТП может вести только преподаватель предмета')
    }
  }
  const semester = await resolveSemester(prisma, body.groupId, body.subjectId)
  const plan = await prisma.$transaction((transaction) => savePlan(transaction, { ...body, semester }))
  return NextResponse.json({ plan })
})
