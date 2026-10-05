import { createHash } from 'node:crypto'
import { lessonDescription, lessonLocation, lessonSummary } from '@/lib/calendar/ics'
import { addDays, formatDate, parseDate } from '@/lib/dates'
import { ApiError } from '@/lib/http'
import type { Lesson } from '@/lib/types'

const calendarApiUrl = 'https://www.googleapis.com/calendar/v3'
const collegeCalendarName = 'Колледж'

type GoogleEvent = { id: string; status: string; start?: { dateTime?: string } }
type SyncResult = { created: number; updated: number; deleted: number }

async function callCalendar(
  accessToken: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  return fetch(`${calendarApiUrl}${path}`, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
}

async function assertOk(response: Response): Promise<Response> {
  if (!response.ok) {
    console.error('Google Calendar request failed', response.status, await response.text())
    throw new ApiError(502, 'GOOGLE_CALENDAR_FAILED', 'Google Calendar отклонил запрос')
  }
  return response
}

export async function ensureCollegeCalendar(
  accessToken: string,
  knownCalendarId: string | null,
  timeZone: string,
): Promise<string> {
  if (knownCalendarId) {
    const existing = await callCalendar(accessToken, `/calendars/${encodeURIComponent(knownCalendarId)}`)
    if (existing.ok) {
      return knownCalendarId
    }
  }
  const response = await assertOk(
    await callCalendar(accessToken, '/calendars', {
      method: 'POST',
      body: { summary: collegeCalendarName, timeZone },
    }),
  )
  const calendar = (await response.json()) as { id: string }
  return calendar.id
}

function eventIdFor(lesson: Lesson): string {
  return createHash('sha1').update(`${lesson.scheduleSlotId}:${lesson.date}`).digest('hex')
}

function eventBody(lesson: Lesson, timeZone: string) {
  return {
    id: eventIdFor(lesson),
    status: 'confirmed',
    summary: lessonSummary(lesson),
    location: lessonLocation(lesson),
    description: lessonDescription(lesson),
    start: { dateTime: `${lesson.date}T${lesson.startTime}:00`, timeZone },
    end: { dateTime: `${lesson.date}T${lesson.endTime}:00`, timeZone },
  }
}

async function listEvents(accessToken: string, calendarId: string, from: string, to: string): Promise<GoogleEvent[]> {
  const events: GoogleEvent[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({
      timeMin: `${shiftBack(from)}T00:00:00Z`,
      timeMax: `${formatDate(addDays(parseDate(to), 2))}T00:00:00Z`,
      showDeleted: 'true',
      singleEvents: 'true',
      maxResults: '2500',
    })
    if (pageToken) {
      params.set('pageToken', pageToken)
    }
    const response = await assertOk(
      await callCalendar(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`),
    )
    const page = (await response.json()) as { items?: GoogleEvent[]; nextPageToken?: string }
    events.push(...(page.items ?? []))
    pageToken = page.nextPageToken
  } while (pageToken)
  return events
}

function shiftBack(date: string): string {
  return formatDate(addDays(parseDate(date), -1))
}

export async function syncLessonsToCalendar(
  accessToken: string,
  calendarId: string,
  lessons: Lesson[],
  range: { from: string; to: string },
  timeZone: string,
): Promise<SyncResult> {
  const eventsPath = `/calendars/${encodeURIComponent(calendarId)}/events`
  const existingEvents = await listEvents(accessToken, calendarId, range.from, range.to)
  const existingStatusById = new Map(existingEvents.map((event) => [event.id, event.status]))
  const result: SyncResult = { created: 0, updated: 0, deleted: 0 }
  const wantedIds = new Set<string>()

  for (const lesson of lessons) {
    const body = eventBody(lesson, timeZone)
    wantedIds.add(body.id)
    if (existingStatusById.has(body.id)) {
      await assertOk(await callCalendar(accessToken, `${eventsPath}/${body.id}`, { method: 'PUT', body }))
      result.updated += 1
    } else {
      await assertOk(await callCalendar(accessToken, eventsPath, { method: 'POST', body }))
      result.created += 1
    }
  }

  for (const event of existingEvents) {
    const eventDate = event.start?.dateTime?.slice(0, 10) ?? ''
    const isStaleInsideRange =
      event.status !== 'cancelled' && !wantedIds.has(event.id) && eventDate >= range.from && eventDate <= range.to
    if (isStaleInsideRange) {
      const response = await callCalendar(accessToken, `${eventsPath}/${event.id}`, { method: 'DELETE' })
      if (response.ok || response.status === 410) {
        result.deleted += 1
      }
    }
  }
  return result
}
