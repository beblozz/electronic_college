'use client'

import { useState } from 'react'
import { WeekNavigator } from '@/components/schedule/week-navigator'
import { balanceTone, formatHourBalance } from '@/components/hours/hours-format'
import { HoursLegend, SubjectHoursTable } from '@/components/hours/hours-tables'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { useApi } from '@/lib/client/api'
import { formatShortDate, todayLocal, weekdayNames, weekStartOf } from '@/lib/dates'
import type { ProgramHoursReport, TeacherLoad } from '@/lib/types'

export default function TeacherLoadPage() {
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayLocal()))
  const load = useApi<TeacherLoad>(`/api/teachers/me/load?weekStart=${weekStart}`)
  const isOverloaded = load.data ? load.data.weeklyHours > load.data.maxHoursPerWeek : false
  const hours = useApi<ProgramHoursReport>('/api/teachers/me/hours')
  const ownTotals = hours.data?.teachers[0]

  return (
    <>
      <PageHeader title="Нагрузка" caption="Одна пара — 2 академических часа">
        <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />
      </PageHeader>
      {load.error ? <ErrorState message={load.error} /> : null}
      {!load.data && load.isLoading ? <LoadingState /> : null}
      {load.data ? (
        <>
          <p className="mb-3">
            За неделю:{' '}
            <span className={`font-medium tabular-nums ${isOverloaded ? 'text-danger' : ''}`}>
              {load.data.weeklyHours} из {load.data.maxHoursPerWeek} ч
            </span>
          </p>
          <Table>
            <thead>
              <tr>
                <Th>День</Th>
                <Th>Пары</Th>
                <Th className="text-right">Часы</Th>
                <Th>Окна</Th>
              </tr>
            </thead>
            <tbody>
              {load.data.days.map((day) => (
                <tr key={day.date}>
                  <Td>
                    {weekdayNames[day.dayOfWeek - 1]}
                    <span className="ml-2 tabular-nums text-muted">{formatShortDate(day.date)}</span>
                  </Td>
                  <Td className="tabular-nums">{day.pairs.length > 0 ? day.pairs.join(', ') : '—'}</Td>
                  <Td className="text-right tabular-nums">{day.hours}</Td>
                  <Td className={`tabular-nums ${day.gaps.length > 0 ? 'text-amber-700' : 'text-muted'}`}>
                    {day.gaps.length > 0 ? `${day.gaps.join(', ')} пара` : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      ) : null}

      <Section title="Вычитка за семестр" className="mt-6">
        {ownTotals ? (
          <p className="mb-2">
            По сетке на сегодня {ownTotals.scheduledHoursToDate} ч, проведено {ownTotals.conductedHoursToDate} ч
            <span className={`ml-1 tabular-nums ${balanceTone(ownTotals.balanceHoursToDate)}`}>
              ({formatHourBalance(ownTotals.balanceHoursToDate)})
            </span>
            . Заменял пар: {ownTotals.takenPairsToDate}, отдал на замену: {ownTotals.givenAwayPairsToDate}.
          </p>
        ) : null}
        {hours.data ? <SubjectHoursTable rows={hours.data.subjects} termEnd={hours.data.term?.endDate ?? null} /> : <LoadingState />}
        <HoursLegend />
      </Section>
    </>
  )
}
