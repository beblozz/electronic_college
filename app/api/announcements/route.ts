import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherGroupIds } from '@/lib/access'
import {
  announcementInclude,
  resolveAudience,
  serializeAnnouncement,
  visibleAnnouncementsWhere,
} from '@/lib/announcements'
import { requireSession } from '@/lib/auth'
import { created, forbidden, parseBody, route } from '@/lib/http'
import { notifyUsers } from '@/lib/notifications/notify'
import { readPage, toPage } from '@/lib/pagination'
import { prisma } from '@/lib/prisma'
import { emitToRooms } from '@/lib/socket'
import { idSchema } from '@/lib/validation/common'

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  targetRole: z.enum(['STUDENT', 'TEACHER', 'ADMIN']).nullish(),
  targetGroupId: idSchema.nullish(),
})

export const GET = route(async (request) => {
  const session = await requireSession()
  const page = readPage(request.nextUrl.searchParams)
  const announcements = await prisma.announcement.findMany({
    where: await visibleAnnouncementsWhere(session),
    include: announcementInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...page.args,
  })
  return NextResponse.json(toPage(announcements, page.limit, serializeAnnouncement))
})

export const POST = route(async (request) => {
  const session = await requireSession('ADMIN', 'TEACHER')
  const body = await parseBody(request, bodySchema)
  const targetRole = body.targetRole ?? null
  const targetGroupId = body.targetGroupId || null

  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    const groupIds = teacher ? await teacherGroupIds(prisma, teacher.id) : []
    if (!targetGroupId || !groupIds.includes(targetGroupId)) {
      throw forbidden('Преподаватель публикует объявления только для своих групп')
    }
  }

  const announcement = await prisma.announcement.create({
    data: { authorId: session.userId, title: body.title, body: body.body, targetRole, targetGroupId },
    include: announcementInclude,
  })
  const serialized = serializeAnnouncement(announcement)
  const audience = await resolveAudience({ targetRole, targetGroupId })

  await emitToRooms(audience.rooms, 'announcement:created', { announcement: serialized })
  await notifyUsers({
    userIds: audience.userIds.filter((userId) => userId !== session.userId),
    type: 'ANNOUNCEMENT_CREATED',
    payload: { announcementId: announcement.id, title: announcement.title },
    push: { title: 'Объявление', body: announcement.title, url: '/announcements' },
  })

  return created({ announcement: serialized })
})
