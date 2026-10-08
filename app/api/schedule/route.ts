import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { parseDate } from '@/lib/dates'
import { badRequest, created, parseBody, parseQuery, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'
import { assertSlotIsValid, serializeSlot, slotSchema } from '@/lib/schedule/slot-service'
import { dateRangeSchema, idSchema } from '@/lib/validation/common'

const filterSchema = z.object({
  groupId: idSchema.optional(),
  teacherId: idSchema.optional(),
  roomId: idSchema.optional(),
})

export const GET = route(async (request) => {
  await requireSession()
  const { from, to } = parseQuery(request, dateRangeSchema)
  const filter = parseQuery(request, filterSchema)
  if (!filter.groupId && !filter.teacherId && !filter.roomId) {
    throw badRequest('Укажите группу, преподавателя или аудиторию')
  }
  const lessons = await expandLessons(prisma, { from: parseDate(from), to: parseDate(to), filter })
  return NextResponse.json({ lessons })
})

export const POST = route(async (request) => {
  await requireSession('ADMIN')
  const input = await parseBody(request, slotSchema)
  const slot = await prisma.$transaction(
    async (transaction) => {
      await assertSlotIsValid(transaction, input)
      return transaction.scheduleSlot.create({ data: input })
    },
    { isolationLevel: 'Serializable' },
  )
  return created({ slot: serializeSlot(slot) })
})
