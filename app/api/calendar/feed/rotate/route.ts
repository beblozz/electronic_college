import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { feedUrl, findOrCreateFeed } from '@/lib/calendar/feed'
import { randomToken } from '@/lib/crypto'
import { route } from '@/lib/http'
import { prisma } from '@/lib/prisma'

export const POST = route(async () => {
  const session = await requireSession('STUDENT', 'TEACHER')
  await findOrCreateFeed(session.userId)
  const feed = await prisma.calendarFeed.update({
    where: { userId: session.userId },
    data: { token: randomToken() },
  })
  return NextResponse.json({ url: feedUrl(feed.token) })
})
