'use client'

import Link from 'next/link'
import { useSocketEvent } from '@/components/layout/realtime-provider'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { useApi } from '@/lib/client/api'
import { formatDisplayDate, shiftDate, todayLocal, weekStartOf } from '@/lib/dates'
import type { AbsenceView, Heatmap, SubstitutionView } from '@/lib/types'

const lookAheadDays = 13

export default function AdminOverviewPage() {
  const today = todayLocal()
  const periodEnd = shiftDate(today, lookAheadDays)
  const absences = useApi<{ absences: AbsenceView[] }>(`/api/admin/absences?from=${today}&to=${periodEnd}`)
  const substitutions = useApi<{ substitutions: SubstitutionView[] }>(`/api/substitutions?from=${today}&to=${periodEnd}`)
  const heatmap = useApi<Heatmap>(`/api/admin/load/heatmap?weekStart=${weekStartOf(today)}`)
  useSocketEvent('notification:new', () => {
    absences.reload()
    substitutions.reload()
  })

  const uncoveredLessons = (absences.data?.absences ?? []).flatMap((absence) => absence.uncoveredLessons)
  const overloadedTeachers = (heatmap.data?.teachers ?? []).filter((teacher) => teacher.isOverloaded)
  const error = absences.error ?? substitutions.error ?? heatmap.error

  const figures = [
    { label: 'Пар без замены', value: uncoveredLessons.length, isAlert: uncoveredLessons.length > 0 },
    { label: 'Отсутствует преподавателей', value: absences.data?.absences.length ?? 0, isAlert: false },
    { label: 'Назначено замен', value: substitutions.data?.substitutions.length ?? 0, isAlert: false },
    { label: 'Перегружено на этой неделе', value: overloadedTeachers.length, isAlert: overloadedTeachers.length > 0 },
  ]

  return (
    <>
      <PageHeader
        title="Обзор"
        caption={`Ближайшие две недели: ${formatDisplayDate(today)} — ${formatDisplayDate(periodEnd)}`}
      />
      {error ? (
        <div className="mb-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mb-6 grid grid-cols-2 rounded border border-line md:grid-cols-4">
        {figures.map((figure) => (
          <div key={figure.label} className="border-b border-r border-line px-3 py-2 last:border-r-0 md:border-b-0">
            <p className="text-caption text-muted">{figure.label}</p>
            <p className={`text-title font-medium tabular-nums ${figure.isAlert ? 'text-danger' : ''}`}>
              {figure.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="Пары без замены"
          aside={
            <Link href="/admin/substitutions" className="text-accent hover:underline">
              Подобрать замены
            </Link>
          }
        >
          {!absences.data ? <LoadingState /> : null}
          {absences.data && uncoveredLessons.length === 0 ? <EmptyState>Все пары закрыты</EmptyState> : null}
          {uncoveredLessons.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Дата</Th>
                  <Th>Пара</Th>
                  <Th>Группа</Th>
                  <Th>Предмет</Th>
                  <Th>Преподаватель</Th>
                </tr>
              </thead>
              <tbody>
                {uncoveredLessons.map((lesson) => (
                  <tr key={`${lesson.scheduleSlotId}:${lesson.date}`}>
                    <Td className="tabular-nums">{formatDisplayDate(lesson.date)}</Td>
                    <Td className="tabular-nums">{lesson.pairNumber}</Td>
                    <Td>{lesson.group.name}</Td>
                    <Td>{lesson.subject.name}</Td>
                    <Td className="text-muted">{lesson.teacher.fullName}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </Section>

        <Section title="Ближайшие замены">
          {!substitutions.data ? <LoadingState /> : null}
          {substitutions.data?.substitutions.length === 0 ? <EmptyState>Замен нет</EmptyState> : null}
          {substitutions.data && substitutions.data.substitutions.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Дата</Th>
                  <Th>Пара</Th>
                  <Th>Группа</Th>
                  <Th>Предмет</Th>
                  <Th>Заменяет</Th>
                </tr>
              </thead>
              <tbody>
                {substitutions.data.substitutions.map(({ id, lesson }) => (
                  <tr key={id}>
                    <Td className="tabular-nums">{formatDisplayDate(lesson.date)}</Td>
                    <Td className="tabular-nums">{lesson.pairNumber}</Td>
                    <Td>{lesson.group.name}</Td>
                    <Td>{lesson.subject.name}</Td>
                    <Td>{lesson.teacher.fullName}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </Section>
      </div>
    </>
  )
}
