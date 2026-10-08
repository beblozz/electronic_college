import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherCanViewJournal, teacherTeachesSubject } from '@/lib/access'
import { requireSession } from '@/lib/auth'
import { addDays, daysBetween, parseDate } from '@/lib/dates'
import { badRequest, forbidden, parseQuery, route } from '@/lib/http'
import { buildJournal } from '@/lib/journal/journal-service'
import { collegeToday, currentTerm } from '@/lib/journal/study-plan'
import { prisma } from '@/lib/prisma'
import { dateSchema } from '@/lib/validation/common'

type Params = { groupId: string; subjectId: string }

const querySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  scope: z.enum(['mine', 'all']).default('mine'),
})
const maxJournalDays = 190
const fallbackJournalDays = 30

export const GET = route<Params>(async (request, { groupId, subjectId }) => {
  const session = await requireSession('TEACHER', 'ADMIN')
  let viewerTeacherId: string | null = null
  let canEditPlan = session.role === 'ADMIN'
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher || !(await teacherCanViewJournal(prisma, teacher.id, groupId, subjectId))) {
      throw forbidden('Журнал этой группы вам недоступен')
    }
    viewerTeacherId = teacher.id
    canEditPlan = await teacherTeachesSubject(prisma, teacher.id, groupId, subjectId)
  }

  const query = parseQuery(request, querySchema)
  const term = await currentTerm(prisma)
  const to = query.to ? parseDate(query.to) : collegeToday()
  const defaultFrom = term && term.startDate <= to ? term.startDate : addDays(to, -fallbackJournalDays)
  const from = query.from ? parseDate(query.from) : defaultFrom
  if (from > to || daysBetween(from, to) > maxJournalDays) {
    throw badRequest(`Период журнала — не более ${maxJournalDays} дней`)
  }

  return NextResponse.json(
    await buildJournal({ groupId, subjectId, from, to, scope: query.scope, viewerTeacherId, canEditPlan }),
  )
})
