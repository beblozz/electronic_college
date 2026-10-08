import type { Lesson } from '@/lib/types'

const maxLineBytes = 73

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

function foldLine(line: string): string {
  const encoder = new TextEncoder()
  const segments: string[] = []
  let current = ''
  let currentBytes = 0
  for (const character of line) {
    const characterBytes = encoder.encode(character).length
    if (currentBytes + characterBytes > maxLineBytes) {
      segments.push(current)
      current = ''
      currentBytes = 0
    }
    current += character
    currentBytes += characterBytes
  }
  segments.push(current)
  return segments.join('\r\n ')
}

function localDateTime(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`
}

function utcStamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
}

export function lessonSummary(lesson: Lesson): string {
  return `${lesson.subject.name} · ${lesson.group.name}`
}

export function lessonLocation(lesson: Lesson): string {
  return `ауд. ${lesson.room.number}, ${lesson.room.building}`
}

export function lessonDescription(lesson: Lesson): string {
  const lines = [`Преподаватель: ${lesson.teacher.fullName}`, `Пара: ${lesson.pairNumber}`]
  if (lesson.substitution) {
    lines.push(`Замена вместо: ${lesson.substitution.originalTeacher.fullName}`)
  }
  return lines.join('\n')
}

export function buildIcsCalendar(lessons: Lesson[], timeZone: string, calendarName: string): string {
  const stamp = utcStamp(new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Electronic College//Schedule//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${timeZone}`,
  ]
  for (const lesson of lessons) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${lesson.scheduleSlotId}-${lesson.date}@electronic-college`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${timeZone}:${localDateTime(lesson.date, lesson.startTime)}`,
      `DTEND;TZID=${timeZone}:${localDateTime(lesson.date, lesson.endTime)}`,
      `SUMMARY:${escapeText(lessonSummary(lesson))}`,
      `LOCATION:${escapeText(lessonLocation(lesson))}`,
      `DESCRIPTION:${escapeText(lessonDescription(lesson))}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
