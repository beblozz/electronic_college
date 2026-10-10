import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherCanViewJournal } from '@/lib/access'
import { requireSession } from '@/lib/auth'
import { forbidden, parseQuery, route } from '@/lib/http'
import { currentTerm } from '@/lib/journal/study-plan'
import { prisma } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'
import { idSchema } from '@/lib/validation/common'

const querySchema = z.object({ groupId: idSchema, subjectId: idSchema })

export const GET = route(async (request) => {
  const session = await requireSession('TEACHER', 'ADMIN')
  const query = parseQuery(request, querySchema)
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher || !(await teacherCanViewJournal(prisma, teacher.id, query.groupId, query.subjectId))) {
      throw forbidden('Журнал этой группы вам недоступен')
    }
  }
  const term = await currentTerm(prisma)
  if (!term) {
    return NextResponse.json({ dates: [] })
  }
  const lessons = await expandLessons(prisma, {
    from: term.startDate,
    to: term.endDate,
    filter: { groupId: query.groupId },
  })
  const dates = [...new Set(lessons.filter((lesson) => lesson.subject.id === query.subjectId).map((lesson) => lesson.date))]
  return NextResponse.json({ dates: dates.sort() })
})
