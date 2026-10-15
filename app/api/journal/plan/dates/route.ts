import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherCanViewJournal } from '@/lib/access'
import { requireSession } from '@/lib/auth'
import { forbidden, parseQuery, route } from '@/lib/http'
import { subjectLessonDates } from '@/lib/journal/plan-dates'
import { prisma } from '@/lib/prisma'
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
  return NextResponse.json({ dates: await subjectLessonDates(prisma, query.groupId, query.subjectId) })
})
