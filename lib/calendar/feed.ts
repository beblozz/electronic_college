import { randomToken } from '@/lib/crypto'
import { appUrl } from '@/lib/env'
import { prisma } from '@/lib/prisma'

export function feedUrl(token: string): string {
  return `${appUrl()}/api/calendar/feed/${token}.ics`
}

export async function findOrCreateFeed(userId: string) {
  return prisma.calendarFeed.upsert({
    where: { userId },
    create: { userId, token: randomToken() },
    update: {},
  })
}
