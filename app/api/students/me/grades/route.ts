import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStudent } from '@/lib/auth'
import { parseDate } from '@/lib/dates'
import { parseQuery, route } from '@/lib/http'
import { serializeGrade } from '@/lib/journal/journal-service'
import { readPage, toPage } from '@/lib/pagination'
import { teacherRef } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { dateSchema, idSchema } from '@/lib/validation/common'

const querySchema = z.object({
  subjectId: idSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
})

export const GET = route(async (request) => {
  const { student } = await requireStudent()
  const query = parseQuery(request, querySchema)
  const page = readPage(request.nextUrl.searchParams)

  const grades = await prisma.grade.findMany({
    where: {
      studentId: student.id,
      subjectId: query.subjectId,
      date: {
        gte: query.from ? parseDate(query.from) : undefined,
        lte: query.to ? parseDate(query.to) : undefined,
      },
    },
    include: { subject: true, teacher: { include: { user: true } } },
    orderBy: [{ date: 'desc' }, { id: 'desc' }],
    ...page.args,
  })

  return NextResponse.json(
    toPage(grades, page.limit, (grade) => ({
      ...serializeGrade(grade),
      subject: { id: grade.subject.id, name: grade.subject.name },
      teacher: teacherRef(grade.teacher),
    })),
  )
})
