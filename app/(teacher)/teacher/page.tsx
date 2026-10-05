'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSocketEvent } from '@/components/layout/realtime-provider'
import { DayLessons } from '@/components/schedule/day-lessons'
import { SickLeaveDialog } from '@/components/schedule/sick-leave-dialog'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { useApi } from '@/lib/client/api'
import { formatDisplayDate, todayLocal, weekStartOf } from '@/lib/dates'
import type { Lesson, TeacherLoad } from '@/lib/types'

export default function TeacherTodayPage() {
  const today = todayLocal()
  const [isSickDialogOpen, setIsSickDialogOpen] = useState(false)
  const schedule = useApi<{ lessons: Lesson[]; teacherId: string }>(
    `/api/teachers/me/schedule?from=${today}&to=${today}`,
  )
  const load = useApi<TeacherLoad>(`/api/teachers/me/load?weekStart=${weekStartOf(today)}`)
  useSocketEvent('substitution:created', () => {
    schedule.reload()
    load.reload()
  })

  return (
    <>
      <PageHeader title="Сегодня" caption={formatDisplayDate(today)}>
        <Button onClick={() => setIsSickDialogOpen(true)}>Сообщить о болезни</Button>
      </PageHeader>

      {schedule.error ? <ErrorState message={schedule.error} /> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Section title="Занятия">
          {schedule.data ? (
            <DayLessons
              lessons={schedule.data.lessons}
              perspective="teacher"
              ownTeacherId={schedule.data.teacherId}
              renderAction={(lesson) =>
                lesson.teacher.id === schedule.data?.teacherId ? (
                  <Link
                    href={`/teacher/journal/${lesson.group.id}/${lesson.subject.id}`}
                    className="text-accent hover:underline"
                  >
                    Журнал
                  </Link>
                ) : null
              }
            />
          ) : (
            <LoadingState />
          )}
        </Section>

        <Section title="Нагрузка на неделе">
          {load.data ? (
            <div className="rounded border border-line px-3 py-2">
              <p className="text-title font-medium tabular-nums">
                {load.data.weeklyHours}
                <span className="text-body font-normal text-muted"> из {load.data.maxHoursPerWeek} ч</span>
              </p>
              <p className="text-caption text-muted">
                Окон: {load.data.days.reduce((total, day) => total + day.gaps.length, 0)}
              </p>
              <Link href="/teacher/load" className="mt-1 inline-block text-accent hover:underline">
                Подробнее
              </Link>
            </div>
          ) : (
            <LoadingState />
          )}
        </Section>
      </div>

      {isSickDialogOpen ? <SickLeaveDialog onClose={() => setIsSickDialogOpen(false)} /> : null}
    </>
  )
}
