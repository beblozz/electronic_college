import { LessonDetails, SchedulePerspective } from '@/components/schedule/lesson-details'
import { EmptyState } from '@/components/ui/states'
import { formatShortDate, shiftDate, todayLocal, weekdayNames, weekdayShortNames } from '@/lib/dates'
import { pairTimes } from '@/lib/schedule/pair-times'
import type { Lesson } from '@/lib/types'

type WeekScheduleProps = {
  lessons: Lesson[]
  weekStart: string
  perspective: SchedulePerspective
  ownTeacherId?: string
}

const minimumVisiblePairs = 4
const workingDayCount = 6

export function WeekSchedule({ lessons, weekStart, perspective, ownTeacherId }: WeekScheduleProps) {
  const today = todayLocal()
  const hasSundayLessons = lessons.some((lesson) => lesson.dayOfWeek === 7)
  const dayCount = hasSundayLessons ? 7 : workingDayCount
  const days = Array.from({ length: dayCount }, (_, index) => shiftDate(weekStart, index))
  const lastPair = Math.max(minimumVisiblePairs, ...lessons.map((lesson) => lesson.pairNumber))
  const visiblePairs = pairTimes.filter((pair) => pair.pairNumber <= lastPair)
  const lessonsAt = (date: string, pairNumber: number) =>
    lessons.filter((lesson) => lesson.date === date && lesson.pairNumber === pairNumber)

  return (
    <>
      <div className="hidden overflow-x-auto rounded border border-line md:block">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-left [&_tbody_tr:last-child_td]:border-b-0">
          <thead>
            <tr>
              <th className="w-20 border-b border-line bg-subtle px-2 py-1.5 text-caption font-medium text-muted">
                Пара
              </th>
              {days.map((date, index) => (
                <th
                  key={date}
                  className={`border-b border-l border-line bg-subtle px-2 py-1.5 text-caption font-medium ${
                    date === today ? 'text-accent' : 'text-muted'
                  }`}
                >
                  {weekdayShortNames[index]}, {formatShortDate(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiblePairs.map((pair) => (
              <tr key={pair.pairNumber}>
                <td className="border-b border-line px-2 py-1.5 align-top">
                  <p className="font-medium">{pair.pairNumber}</p>
                  <p className="text-caption tabular-nums text-muted">{pair.startTime}</p>
                  <p className="text-caption tabular-nums text-muted">{pair.endTime}</p>
                </td>
                {days.map((date) => (
                  <td key={date} className="border-b border-l border-line px-2 py-1.5 align-top">
                    <div className="flex flex-col gap-2">
                      {lessonsAt(date, pair.pairNumber).map((lesson) => (
                        <LessonDetails
                          key={lesson.scheduleSlotId}
                          lesson={lesson}
                          perspective={perspective}
                          ownTeacherId={ownTeacherId}
                        />
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 md:hidden">
        {lessons.length === 0 ? <EmptyState>На этой неделе занятий нет</EmptyState> : null}
        {days.map((date, index) => {
          const dayLessons = lessons.filter((lesson) => lesson.date === date)
          if (dayLessons.length === 0) {
            return null
          }
          return (
            <section key={date}>
              <h2 className={`mb-1 text-body font-medium ${date === today ? 'text-accent' : ''}`}>
                {weekdayNames[index]}, {formatShortDate(date)}
              </h2>
              <div className="rounded border border-line">
                {dayLessons.map((lesson) => (
                  <div
                    key={lesson.scheduleSlotId}
                    className="flex gap-3 border-b border-line px-3 py-2 last:border-b-0"
                  >
                    <div className="w-12 shrink-0 text-caption tabular-nums text-muted">
                      <p className="text-body font-medium text-ink">{lesson.pairNumber}</p>
                      <p>{lesson.startTime}</p>
                    </div>
                    <LessonDetails lesson={lesson} perspective={perspective} ownTeacherId={ownTeacherId} />
                  </div>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}
