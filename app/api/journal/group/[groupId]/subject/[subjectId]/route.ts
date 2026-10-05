import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherCanViewJournal } from '@/lib/access'
import { requireSession } from '@/lib/auth'
import { addDays, daysBetween, parseDate, todayInTimeZone } from '@/lib/dates'
import { collegeTimeZone } from '@/lib/env'
import { badRequest, forbidden, parseQuery, route } from '@/lib/http'
import { buildJournal } from '@/lib/journal/journal-service'
import { prisma } from '@/lib/prisma'
import { dateSchema } from '@/lib/validation/common'

type Params = { groupId: string; subjectId: string }

const querySchema = z.object({ from: dateSchema.optional(), to: dateSchema.optional() })
const maxJournalDays = 190
const defaultJournalDays = 30

export const GET = route<Params>(async (request, { groupId, subjectId }) => {
  const session = await requireSession('TEACHER', 'ADMIN')
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher || !(await teacherCanViewJournal(prisma, teacher.id, groupId, subjectId))) {
      throw forbidden('Журнал этой группы вам недоступен')
    }
  }

  const query = parseQuery(request, querySchema)
  const to = parseDate(query.to ?? todayInTimeZone(collegeTimeZone()))
  const from = query.from ? parseDate(query.from) : addDays(to, -defaultJournalDays)
  if (from > to || daysBetween(from, to) > maxJournalDays) {
    throw badRequest(`Период журнала — не более ${maxJournalDays} дней`)
  }

  return NextResponse.json(await buildJournal(groupId, subjectId, from, to))
})
