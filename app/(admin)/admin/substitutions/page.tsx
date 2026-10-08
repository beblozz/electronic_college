'use client'

import { useState } from 'react'
import { text, useDirectory } from '@/components/admin/use-directory'
import { useSocketEvent } from '@/components/layout/realtime-provider'
import { DayLessons } from '@/components/schedule/day-lessons'
import { AbsenceDialog } from '@/components/substitutions/absence-dialog'
import { reasonLabels } from '@/components/substitutions/reason-labels'
import { SuggestDialog } from '@/components/substitutions/suggest-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import { formatDisplayDate, shiftDate, todayLocal } from '@/lib/dates'
import type { AbsenceReason, AbsenceView, Lesson, SubstitutionView } from '@/lib/types'

type SuggestTarget = { lesson: Lesson; reason: AbsenceReason }

const lookAheadDays = 13

export default function AdminSubstitutionsPage() {
  const today = todayLocal()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(() => shiftDate(today, lookAheadDays))
  const [suggestTarget, setSuggestTarget] = useState<SuggestTarget | null>(null)
  const [isAbsenceDialogOpen, setIsAbsenceDialogOpen] = useState(false)
  const [lookupTeacherId, setLookupTeacherId] = useState('')
  const [lookupDate, setLookupDate] = useState(today)
  const [error, setError] = useState<string | null>(null)

  const teachers = useDirectory('teachers')
  const absences = useApi<{ absences: AbsenceView[] }>(`/api/admin/absences?from=${from}&to=${to}`)
  const substitutions = useApi<{ substitutions: SubstitutionView[] }>(`/api/substitutions?from=${from}&to=${to}`)
  const lookup = useApi<{ lessons: Lesson[] }>(
    lookupTeacherId ? `/api/schedule?teacherId=${lookupTeacherId}&from=${lookupDate}&to=${lookupDate}` : null,
  )

  const reloadAll = () => {
    absences.reload()
    substitutions.reload()
    lookup.reload()
  }
  useSocketEvent('notification:new', reloadAll)

  const runAndReload = async (action: () => Promise<unknown>) => {
    try {
      await action()
      setError(null)
      reloadAll()
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  const loadError = absences.error ?? substitutions.error ?? error

  return (
    <>
      <PageHeader title="Замены">
        <Field label="С">
          <Input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="По">
          <Input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
        </Field>
        <Button variant="primary" onClick={() => setIsAbsenceDialogOpen(true)}>
          Отметить отсутствие
        </Button>
      </PageHeader>

      {loadError ? (
        <div className="mb-4">
          <ErrorState message={loadError} />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Отсутствия и пары без замены">
          {!absences.data ? <LoadingState /> : null}
          {absences.data?.absences.length === 0 ? <EmptyState>Отсутствий в периоде нет</EmptyState> : null}
          <div className="flex flex-col gap-3">
            {(absences.data?.absences ?? []).map((absence) => (
              <div key={absence.id} className="rounded border border-line">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-subtle px-3 py-1.5">
                  <p>
                    <span className="font-medium">{absence.teacher.fullName}</span>
                    <span className="ml-2 text-caption tabular-nums text-muted">
                      {reasonLabels[absence.reason]}, {formatDisplayDate(absence.startDate)} —{' '}
                      {formatDisplayDate(absence.endDate)}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    {absence.uncoveredLessons.length > 0 ? (
                      <Badge tone="danger">без замены: {absence.uncoveredLessons.length}</Badge>
                    ) : (
                      <Badge tone="success">все пары закрыты</Badge>
                    )}
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={() =>
                        runAndReload(() => apiFetch(`/api/admin/absences/${absence.id}`, { method: 'DELETE' }))
                      }
                    >
                      Снять
                    </Button>
                  </div>
                </div>
                {absence.uncoveredLessons.map((lesson) => (
                  <div
                    key={`${lesson.scheduleSlotId}:${lesson.date}`}
                    className="flex items-center justify-between gap-3 border-b border-line px-3 py-1.5 last:border-b-0"
                  >
                    <p className="min-w-0 truncate">
                      <span className="tabular-nums text-muted">
                        {formatDisplayDate(lesson.date)}, {lesson.pairNumber} пара
                      </span>{' '}
                      {lesson.subject.name} · {lesson.group.name}
                    </p>
                    <Button size="small" onClick={() => setSuggestTarget({ lesson, reason: absence.reason })}>
                      Подобрать
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Замена для любой пары">
          <div className="mb-2 flex flex-wrap items-end gap-3">
            <Field label="Преподаватель" className="w-56">
              <Select value={lookupTeacherId} onChange={(event) => setLookupTeacherId(event.target.value)}>
                <option value="">Выберите</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {text(teacher, 'fullName')}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Дата">
              <Input type="date" value={lookupDate} onChange={(event) => setLookupDate(event.target.value)} />
            </Field>
          </div>
          {lookup.error ? <ErrorState message={lookup.error} /> : null}
          {lookupTeacherId && lookup.data ? (
            <DayLessons
              lessons={lookup.data.lessons}
              perspective="full"
              renderAction={(lesson) =>
                lesson.substitution ? null : (
                  <Button size="small" onClick={() => setSuggestTarget({ lesson, reason: 'OTHER' })}>
                    Подобрать
                  </Button>
                )
              }
            />
          ) : (
            <EmptyState>Выберите преподавателя и дату</EmptyState>
          )}
        </Section>
      </div>

      <Section title="Назначенные замены" className="mt-6">
        {substitutions.data?.substitutions.length === 0 ? <EmptyState>Замен в периоде нет</EmptyState> : null}
        {substitutions.data && substitutions.data.substitutions.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Дата</Th>
                <Th>Пара</Th>
                <Th>Группа</Th>
                <Th>Предмет</Th>
                <Th>Вместо</Th>
                <Th>Заменяет</Th>
                <Th>Причина</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {substitutions.data.substitutions.map(({ id, lesson, reason }) => (
                <tr key={id}>
                  <Td className="tabular-nums">{formatDisplayDate(lesson.date)}</Td>
                  <Td className="tabular-nums">{lesson.pairNumber}</Td>
                  <Td>{lesson.group.name}</Td>
                  <Td>
                    {lesson.substitution?.originalSubject.name}
                    {lesson.substitution && lesson.substitution.kind !== 'SAME_SUBJECT' ? (
                      <span className="block text-caption text-muted">
                        {lesson.substitution.kind === 'COMBINED'
                          ? `совмещение с ${lesson.substitution.combinedWithGroupName ?? 'группой'}: ${lesson.subject.name}`
                          : `проведут: ${lesson.subject.name}`}
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-muted">{lesson.substitution?.originalTeacher.fullName}</Td>
                  <Td className="font-medium">{lesson.substitution?.substituteTeacher.fullName}</Td>
                  <Td className="text-muted">{reasonLabels[reason]}</Td>
                  <Td className="w-px text-right">
                    <Button
                      size="small"
                      variant="ghost"
                      onClick={() => runAndReload(() => apiFetch(`/api/substitutions/${id}`, { method: 'DELETE' }))}
                    >
                      Отменить
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Section>

      {suggestTarget ? (
        <SuggestDialog
          lesson={suggestTarget.lesson}
          defaultReason={suggestTarget.reason}
          onClose={() => setSuggestTarget(null)}
          onAssigned={() => {
            setSuggestTarget(null)
            reloadAll()
          }}
        />
      ) : null}
      {isAbsenceDialogOpen ? (
        <AbsenceDialog
          onClose={() => setIsAbsenceDialogOpen(false)}
          onSaved={() => {
            setIsAbsenceDialogOpen(false)
            reloadAll()
          }}
        />
      ) : null}
    </>
  )
}
