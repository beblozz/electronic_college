import { buildIcsCalendar } from '@/lib/calendar/ics'
import { parseDate, todayInTimeZone } from '@/lib/dates'
import { collegeTimeZone } from '@/lib/env'
import { notFound, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { currentTermRange, lessonsForUser } from '@/lib/schedule/user-lessons'

type Params = { token: string }

export const GET = route<Params>(async (_request, { token }) => {
  const feed = await prisma.calendarFeed.findUnique({ where: { token: token.replace(/\.ics$/, '') } })
  if (!feed) {
    throw notFound('Календарь не найден')
  }
  const timeZone = collegeTimeZone()
  const range = await currentTermRange(parseDate(todayInTimeZone(timeZone)))
  const lessons = range ? await lessonsForUser(feed.userId, range.from, range.to) : []

  return new Response(buildIcsCalendar(lessons, timeZone, 'Расписание колледжа'), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="schedule.ics"',
      'cache-control': 'private, max-age=900',
    },
  })
})
