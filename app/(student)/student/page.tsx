'use client'

import { gradeKindLabels } from '@/components/journal/journal-labels'
import { PlanStatus } from '@/components/journal/plan-status'
import { useSocketEvent } from '@/components/layout/realtime-provider'
import { DayLessons } from '@/components/schedule/day-lessons'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { useApi } from '@/lib/client/api'
import { formatDisplayDate, todayLocal } from '@/lib/dates'
import type { Diary, Lesson } from '@/lib/types'

function gradeClass(value: number): string {
  return value <= 2 ? 'text-danger' : 'text-ink'
}

export default function StudentDiaryPage() {
  const today = todayLocal()
  const diary = useApi<Diary>('/api/students/me')
  const todayLessons = useApi<{ lessons: Lesson[] }>(`/api/students/me/schedule?from=${today}&to=${today}`)
  useSocketEvent('grade:created', diary.reload)
  useSocketEvent('substitution:created', todayLessons.reload)

  if (diary.error) {
    return <ErrorState message={diary.error} />
  }
  if (!diary.data) {
    return <LoadingState />
  }
  const { student, subjects, averageGrade, semester } = diary.data

  return (
    <>
      <PageHeader
        title="Дневник"
        caption={`Группа ${student.group.name}${semester ? `, ${semester} семестр` : ''}`}
      >
        <p className="text-body">
          Средний балл: <span className="font-medium tabular-nums">{averageGrade?.toFixed(2) ?? '—'}</span>
        </p>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Section title="Предметы">
          <Table>
            <thead>
              <tr>
                <Th>Предмет</Th>
                <Th className="hidden md:table-cell">Преподаватель</Th>
                <Th>Оценки</Th>
                <Th className="text-right">Средний</Th>
                <Th className="text-right">Пропуски</Th>
                <Th>КТП</Th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((subject) => (
                <tr key={subject.subjectId}>
                  <Td className="font-medium">{subject.name}</Td>
                  <Td className="hidden text-muted md:table-cell">{subject.teacher.fullName}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-x-2 tabular-nums">
                      {subject.grades.length === 0 ? <span className="text-muted">—</span> : null}
                      {subject.grades.map((grade) => (
                        <span
                          key={grade.id}
                          title={[formatDisplayDate(grade.date), gradeKindLabels[grade.kind], grade.comment]
                            .filter(Boolean)
                            .join(' · ')}
                          className={gradeClass(grade.value)}
                        >
                          {grade.value}
                        </span>
                      ))}
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">{subject.averageGrade?.toFixed(2) ?? '—'}</Td>
                  <Td className={`text-right tabular-nums ${subject.attendance.absent > 0 ? 'text-danger' : 'text-muted'}`}>
                    {subject.attendance.absent}
                  </Td>
                  <Td>
                    <PlanStatus progress={subject.plan} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Section>

        <Section title={`Сегодня, ${formatDisplayDate(today)}`}>
          {todayLessons.data ? (
            <DayLessons lessons={todayLessons.data.lessons} perspective="group" />
          ) : (
            <LoadingState />
          )}
        </Section>
      </div>
    </>
  )
}
