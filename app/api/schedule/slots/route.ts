import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { parseQuery, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { serializeSlotView, slotViewInclude } from '@/lib/schedule/slot-service'
import { idSchema } from '@/lib/validation/common'

const querySchema = z.object({
  groupId: idSchema.optional(),
  teacherId: idSchema.optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
})

export const GET = route(async (request) => {
  await requireSession('ADMIN')
  const query = parseQuery(request, querySchema)
  const slots = await prisma.scheduleSlot.findMany({
    where: query,
    include: slotViewInclude,
    orderBy: [{ dayOfWeek: 'asc' }, { pairNumber: 'asc' }],
  })
  return NextResponse.json({ slots: slots.map(serializeSlotView) })
})
