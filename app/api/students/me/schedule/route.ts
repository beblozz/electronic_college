import { NextResponse } from 'next/server'
import { requireStudent } from '@/lib/auth'
import { parseDate } from '@/lib/dates'
import { parseQuery, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'
import { dateRangeSchema } from '@/lib/validation/common'

export const GET = route(async (request) => {
  const { student } = await requireStudent()
  const { from, to } = parseQuery(request, dateRangeSchema)
  const lessons = await expandLessons(prisma, {
    from: parseDate(from),
    to: parseDate(to),
    filter: { groupId: student.groupId },
  })
  return NextResponse.json({ lessons })
})
