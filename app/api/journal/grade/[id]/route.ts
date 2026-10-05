import { NextResponse } from 'next/server'
import { z } from 'zod'
import { noContent, notFound, parseBody, route } from '@/lib/http'
import { assertCanEditGrade } from '@/lib/journal/grade-access'
import { serializeGrade } from '@/lib/journal/journal-service'
import { prisma } from '@/lib/prisma'

type Params = { id: string }

const bodySchema = z.object({
  value: z.number().int().min(2).max(5).optional(),
  comment: z.string().trim().max(500).nullable().optional(),
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
  await loadEditableGrade(id)
  const body = await parseBody(request, bodySchema)
  const grade = await prisma.grade.update({
    where: { id },
    data: { value: body.value, comment: body.comment === undefined ? undefined : body.comment || null },
  })
  return NextResponse.json({ grade: serializeGrade(grade) })
})

export const DELETE = route<Params>(async (_request, { id }) => {
  await loadEditableGrade(id)
  await prisma.grade.delete({ where: { id } })
  return noContent()
})
