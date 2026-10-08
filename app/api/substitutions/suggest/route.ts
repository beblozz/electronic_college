import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { parseDate } from '@/lib/dates'
import { parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { defaultMaxConsecutivePairs, suggestCandidates } from '@/lib/substitutions/suggest-candidates'
import { syncTeacherStatuses } from '@/lib/teacher-status'
import { dateSchema, idSchema } from '@/lib/validation/common'

const bodySchema = z.object({
  scheduleSlotId: idSchema,
  date: dateSchema,
  maxConsecutivePairs: z.number().int().min(1).max(8).default(defaultMaxConsecutivePairs),
})

export const POST = route(async (request) => {
  await requireSession('ADMIN')
  const body = await parseBody(request, bodySchema)
  await syncTeacherStatuses(prisma)
  const suggestions = await suggestCandidates(prisma, {
    scheduleSlotId: body.scheduleSlotId,
    date: parseDate(body.date),
    maxConsecutivePairs: body.maxConsecutivePairs,
  })
  return NextResponse.json(suggestions)
})
