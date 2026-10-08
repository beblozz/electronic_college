import { NextResponse } from 'next/server'
import { z } from 'zod'
import { noContent, notFound, parseBody, route } from '@/lib/http'
import { assertCanEditGrade } from '@/lib/journal/grade-access'
import { gradeInclude, serializeGrade } from '@/lib/journal/journal-service'
import { assertPlanItem } from '@/lib/journal/plan-item'
import { prisma } from '@/lib/prisma'
import { idSchema } from '@/lib/validation/common'

type Params = { id: string }

const bodySchema = z.object({
  value: z.number().int().min(2).max(5).optional(),
  comment: z.string().trim().max(500).nullable().optional(),
  kind: z.enum(['ANSWER', 'SURVEY', 'PRACTICAL', 'LECTURE', 'TEST']).optional(),
  planItemId: idSchema.nullable().optional(),
})

async function loadEditableGrade(id: string) {
  const grade = await prisma.grade.findUnique({ where: { id } })
  if (!grade) {
    throw notFound('Оценка не найдена')
  }
  await assertCanEditGrade(grade.teacherId)
  return grade
}

export const PATCH = route<Params>(async (request, { id }) => {
  const current = await loadEditableGrade(id)
  const body = await parseBody(request, bodySchema)
  const student = await prisma.student.findUniqueOrThrow({ where: { id: current.studentId } })
  const planItemId =
    body.planItemId === undefined ? undefined : await assertPlanItem(body.planItemId, student.groupId, current.subjectId)
  const grade = await prisma.grade.update({
    where: { id },
    data: {
      value: body.value,
      comment: body.comment === undefined ? undefined : body.comment || null,
      kind: body.kind,
      planItemId,
    },
    include: gradeInclude,
  })
  return NextResponse.json({ grade: serializeGrade(grade) })
})

export const DELETE = route<Params>(async (_request, { id }) => {
  await loadEditableGrade(id)
  await prisma.grade.delete({ where: { id } })
  return noContent()
})
