import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { route } from '@/lib/http'
import { serializeNotification } from '@/lib/notifications/notify'
import { readPage, toPage } from '@/lib/pagination'
import { prisma } from '@/lib/prisma'

export const GET = route(async (request) => {
  const session = await requireSession()
  const params = request.nextUrl.searchParams
  const page = readPage(params)
  const isUnreadOnly = params.get('unreadOnly') === 'true'

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.userId, readAt: isUnreadOnly ? null : undefined },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...page.args,
    }),
    prisma.notification.count({ where: { userId: session.userId, readAt: null } }),
  ])
  return NextResponse.json({ ...toPage(notifications, page.limit, serializeNotification), unreadCount })
})
