import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { idSchema } from '@/lib/validation/common'

export const POST = route(async (request) => {
  const session = await requireSession()
  const { ids } = await parseBody(request, z.object({ ids: z.array(idSchema).max(500).optional() }))
  const result = await prisma.notification.updateMany({
    where: { userId: session.userId, readAt: null, id: ids ? { in: ids } : undefined },
    data: { readAt: new Date() },
  })
  return NextResponse.json({ updated: result.count })
})
