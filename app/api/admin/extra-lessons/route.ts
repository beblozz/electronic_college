import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { addDays } from '@/lib/dates'
import { created, notFound, parseBody, parseQuery, route } from '@/lib/http'
import { collegeToday, currentTerm } from '@/lib/journal/study-plan'
import { prisma } from '@/lib/prisma'
import { createExtraLesson, extraLessonSchema, listExtraLessons } from '@/lib/schedule/extra-lessons'
import { idSchema } from '@/lib/validation/common'

const querySchema = z.object({ termId: idSchema.optional() })
const fallbackPastDays = 30
const fallbackFutureDays = 90

export const GET = route(async (request) => {
  await requireSession('ADMIN')
  const query = parseQuery(request, querySchema)
  const term = query.termId
    ? await prisma.term.findUnique({ where: { id: query.termId } })
    : await currentTerm(prisma)
  if (query.termId && !term) {
    throw notFound('Семестр не найден')
  }
  const today = collegeToday()
  const from = term?.startDate ?? addDays(today, -fallbackPastDays)
  const to = term?.endDate ?? addDays(today, fallbackFutureDays)
  const lessons = await listExtraLessons(prisma, from, to)
  return NextResponse.json({ lessons })
})

export const POST = route(async (request) => {
  await requireSession('ADMIN')
  const input = await parseBody(request, extraLessonSchema)
  const lesson = await createExtraLesson(input)
  return created({ lesson })
})
