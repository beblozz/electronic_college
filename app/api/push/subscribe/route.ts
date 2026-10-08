import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { noContent, parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(500) }),
})

export const POST = route(async (request) => {
  const session = await requireSession()
  const { endpoint, keys } = await parseBody(request, bodySchema)
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: session.userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: session.userId, p256dh: keys.p256dh, auth: keys.auth },
  })
  return noContent()
})
