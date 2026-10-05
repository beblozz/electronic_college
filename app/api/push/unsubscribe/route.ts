import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { noContent, parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'

export const POST = route(async (request) => {
  const session = await requireSession()
  const { endpoint } = await parseBody(request, z.object({ endpoint: z.string().min(1) }))
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.userId } })
  return noContent()
})
