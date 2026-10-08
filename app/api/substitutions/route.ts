import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { formatDate, parseDate } from '@/lib/dates'
import { created, parseBody, parseQuery, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { expandLessons, LessonFilter } from '@/lib/schedule/expand-lessons'
import { createSubstitution } from '@/lib/substitutions/create-substitution'
import type { SubstitutionView } from '@/lib/types'
import { dateRangeSchema, dateSchema, idSchema } from '@/lib/validation/common'

const filterSchema = z.object({ groupId: idSchema.optional(), teacherId: idSchema.optional() })

const bodySchema = z
  .object({
    scheduleSlotId: idSchema,
    date: dateSchema,
    substituteTeacherId: idSchema.optional(),
    subjectId: idSchema.optional(),
    combinedWithSlotId: idSchema.optional(),
    reason: z.enum(['SICK', 'VACATION', 'OTHER']),
  })
  .refine((body) => body.substituteTeacherId || body.combinedWithSlotId, 'Выберите преподавателя или пару для совмещения')

export const GET = route(async (request) => {
  const session = await requireSession()
  const { from, to } = parseQuery(request, dateRangeSchema)
  const requestedFilter = parseQuery(request, filterSchema)

  let filter: LessonFilter = requestedFilter
  if (session.role === 'STUDENT') {
    const student = await prisma.student.findUniqueOrThrow({ where: { userId: session.userId } })
    filter = { groupId: student.groupId }
  }
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUniqueOrThrow({ where: { userId: session.userId } })
    filter = { teacherId: teacher.id }
  }

  const range = { from: parseDate(from), to: parseDate(to) }
  const [lessons, substitutions] = await Promise.all([
    expandLessons(prisma, { ...range, filter }),
    prisma.substitution.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      select: { id: true, date: true, createdAt: true },
    }),
  ])
  const createdAtById = new Map(substitutions.map((item) => [item.id, item.createdAt.toISOString()]))

  const views: SubstitutionView[] = lessons.flatMap((lesson) =>
    lesson.substitution
      ? [
          {
            id: lesson.substitution.id,
            date: lesson.date,
            reason: lesson.substitution.reason,
            createdAt: createdAtById.get(lesson.substitution.id) ?? formatDate(range.from),
            lesson,
          },
        ]
      : [],
  )
  return NextResponse.json({ substitutions: views })
})

export const POST = route(async (request) => {
  const session = await requireSession('ADMIN')
  const body = await parseBody(request, bodySchema)
  const substitution = await createSubstitution({
    scheduleSlotId: body.scheduleSlotId,
    date: parseDate(body.date),
    substituteTeacherId: body.substituteTeacherId,
    subjectId: body.subjectId,
    combinedWithSlotId: body.combinedWithSlotId,
    reason: body.reason,
    adminUserId: session.userId,
  })
  return created({ substitution })
})
