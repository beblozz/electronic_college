import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { noContent, notFound, parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { assertSlotIsValid, serializeSlot, slotSchema } from '@/lib/schedule/slot-service'

type Params = { id: string }

export const PATCH = route<Params>(async (request, { id }) => {
  await requireSession('ADMIN')
  const changes = await parseBody(request, slotSchema.partial())
  const slot = await prisma.$transaction(
    async (transaction) => {
      const current = await transaction.scheduleSlot.findUnique({ where: { id } })
      if (!current) {
        throw notFound('Пара не найдена')
      }
      const merged = slotSchema.parse({ ...serializeSlot(current), ...changes })
      await assertSlotIsValid(transaction, merged, id)
      return transaction.scheduleSlot.update({ where: { id }, data: merged })
    },
    { isolationLevel: 'Serializable' },
  )
  return NextResponse.json({ slot: serializeSlot(slot) })
})

export const DELETE = route<Params>(async (_request, { id }) => {
  await requireSession('ADMIN')
  await prisma.scheduleSlot.delete({ where: { id } })
  return noContent()
})
