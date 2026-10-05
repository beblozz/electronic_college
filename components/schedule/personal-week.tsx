'use client'

import { useState } from 'react'
import { useSocketEvent } from '@/components/layout/realtime-provider'
import { SchedulePerspective } from '@/components/schedule/lesson-details'
import { WeekNavigator } from '@/components/schedule/week-navigator'
import { WeekSchedule } from '@/components/schedule/week-schedule'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { useApi } from '@/lib/client/api'
import { shiftDate, todayLocal, weekStartOf } from '@/lib/dates'
import type { Lesson } from '@/lib/types'

type PersonalWeekProps = { endpoint: string; perspective: SchedulePerspective }

export function PersonalWeek({ endpoint, perspective }: PersonalWeekProps) {
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayLocal()))
  const schedule = useApi<{ lessons: Lesson[]; teacherId?: string }>(
    `${endpoint}?from=${weekStart}&to=${shiftDate(weekStart, 6)}`,
  )
  useSocketEvent('substitution:created', schedule.reload)

  return (
    <>
      <PageHeader title="Расписание">
        <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />
      </PageHeader>
      {schedule.error ? <ErrorState message={schedule.error} /> : null}
      {schedule.data ? (
        <WeekSchedule
          lessons={schedule.data.lessons}
          weekStart={weekStart}
          perspective={perspective}
          ownTeacherId={schedule.data.teacherId}
        />
      ) : schedule.isLoading ? (
        <LoadingState />
      ) : null}
    </>
  )
}
