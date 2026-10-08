import type { ReactNode } from 'react'
import { LessonDetails, SchedulePerspective } from '@/components/schedule/lesson-details'
import { EmptyState } from '@/components/ui/states'
import type { Lesson } from '@/lib/types'

type DayLessonsProps = {
  lessons: Lesson[]
  perspective: SchedulePerspective
  ownTeacherId?: string
  renderAction?: (lesson: Lesson) => ReactNode
}

export function DayLessons({ lessons, perspective, ownTeacherId, renderAction }: DayLessonsProps) {
  if (lessons.length === 0) {
    return <EmptyState>Занятий нет</EmptyState>
  }
  return (
    <div className="rounded border border-line">
      {lessons.map((lesson) => (
        <div
          key={`${lesson.scheduleSlotId}:${lesson.date}`}
          className="flex items-start gap-3 border-b border-line px-3 py-2 last:border-b-0"
        >
          <div className="w-24 shrink-0 tabular-nums">
            <p className="font-medium">{lesson.pairNumber} пара</p>
            <p className="text-caption text-muted">
              {lesson.startTime}–{lesson.endTime}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <LessonDetails lesson={lesson} perspective={perspective} ownTeacherId={ownTeacherId} />
          </div>
          {renderAction ? <div className="shrink-0">{renderAction(lesson)}</div> : null}
        </div>
      ))}
    </div>
  )
}
