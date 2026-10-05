import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { ensureCollegeCalendar, syncLessonsToCalendar } from '@/lib/calendar/google-calendar'
import { decryptSecret } from '@/lib/crypto'
import { parseDate } from '@/lib/dates'
import { collegeTimeZone } from '@/lib/env'
import { refreshGoogleAccessToken } from '@/lib/google-oauth'
import { badRequest, parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { lessonsForUser } from '@/lib/schedule/user-lessons'
import { dateRangeSchema } from '@/lib/validation/common'

export const POST = route(async (request) => {
  const session = await requireSession('STUDENT', 'TEACHER')
  const range = await parseBody(request, dateRangeSchema)
  const feed = await prisma.calendarFeed.findUnique({ where: { userId: session.userId } })
  if (!feed?.googleRefreshToken) {
    throw badRequest('Сначала подключите Google Calendar')
  }

  const timeZone = collegeTimeZone()
  const accessToken = await refreshGoogleAccessToken(decryptSecret(feed.googleRefreshToken))
  const calendarId = await ensureCollegeCalendar(accessToken, feed.googleCalendarId, timeZone)
  if (calendarId !== feed.googleCalendarId) {
    await prisma.calendarFeed.update({ where: { userId: session.userId }, data: { googleCalendarId: calendarId } })
  }

  const lessons = await lessonsForUser(session.userId, parseDate(range.from), parseDate(range.to))
  return NextResponse.json(await syncLessonsToCalendar(accessToken, calendarId, lessons, range, timeZone))
})
