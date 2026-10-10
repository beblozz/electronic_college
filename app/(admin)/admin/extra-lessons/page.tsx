'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { text, useDirectory } from '@/components/admin/use-directory'
import { ExtraLessonDialog, ExtraLessonDraft } from '@/components/extra-lessons/extra-lesson-dialog'
import { formatHourBalance } from '@/components/hours/hours-format'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import { formatDisplayDate, todayLocal } from '@/lib/dates'
import type { Lesson, ProgramHoursReport } from '@/lib/types'

const debtReason = 'Отработка долга по вычитке'

export default function AdminExtraLessonsPage() {
  const terms = useDirectory('terms')
  const groups = useDirectory('groups')
  const teachers = useDirectory('teachers')
  const rooms = useDirectory('rooms')
  const [termId, setTermId] = useState('')
  const [draft, setDraft] = useState<ExtraLessonDraft | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!termId && terms.length > 0) {
      const today = todayLocal()
      const current = terms.find((term) => text(term, 'startDate') <= today && text(term, 'endDate') >= today)
      setTermId((current ?? terms[0]).id)
    }
  }, [terms, termId])

  const lessons = useApi<{ lessons: Lesson[] }>(termId ? `/api/admin/extra-lessons?termId=${termId}` : null)
  const hours = useApi<ProgramHoursReport>(termId ? `/api/admin/hours?termId=${termId}` : null)
  const debts = (hours.data?.subjects ?? [])
    .filter((row) => row.status === 'BEHIND')
    .sort((first, second) => first.forecastBalanceHours - second.forecastBalanceHours)
  const today = todayLocal()

  const reload = () => {
    lessons.reload()
    hours.reload()
  }

  const remove = async (lesson: Lesson) => {
    try {
      await apiFetch(`/api/admin/extra-lessons/${lesson.scheduleSlotId}`, { method: 'DELETE' })
      setError(null)
      reload()
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  return (
    <>
      <PageHeader title="Доп. пары" caption="Разовые пары сверх сетки: отработка долгов, консультации, переносы">
        <Field label="Семестр" className="w-60">
          <Select value={termId} onChange={(event) => setTermId(event.target.value)}>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {text(term, 'name')}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="primary" onClick={() => setDraft({})} disabled={groups.length === 0}>
          <Plus size={16} strokeWidth={1.5} />
          Назначить доп. пару
        </Button>
      </PageHeader>

      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}

      <Section title="Назначенные" className="mb-6">
        {lessons.error ? <ErrorState message={lessons.error} /> : null}
        {!lessons.data && lessons.isLoading ? <LoadingState /> : null}
        {lessons.data && lessons.data.lessons.length === 0 ? <EmptyState>В этом семестре доп. пар нет</EmptyState> : null}
        {lessons.data && lessons.data.lessons.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Дата</Th>
                <Th>Пара</Th>
                <Th>Группа</Th>
                <Th>Предмет</Th>
                <Th>Преподаватель</Th>
                <Th>Аудитория</Th>
                <Th>Причина</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lessons.data.lessons.map((lesson) => (
                <tr key={`${lesson.scheduleSlotId}:${lesson.date}`} className={lesson.date < today ? 'text-muted' : ''}>
                  <Td className="whitespace-nowrap tabular-nums">{formatDisplayDate(lesson.date)}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {lesson.pairNumber}, {lesson.startTime}
                  </Td>
                  <Td>{lesson.group.name}</Td>
                  <Td>
                    {lesson.subject.name}
                    {lesson.substitution ? (
                      <span className="block text-caption text-muted">замена: {lesson.substitution.substituteTeacher.fullName}</span>
                    ) : null}
                  </Td>
                  <Td>{lesson.teacher.fullName}</Td>
                  <Td>{lesson.room.number}</Td>
                  <Td className="text-muted">{lesson.extra?.reason ?? ''}</Td>
                  <Td className="text-right">
                    <Button size="small" variant="ghost" aria-label="Отменить доп. пару" title="Отменить" onClick={() => remove(lesson)}>
                      <Trash2 size={16} strokeWidth={1.5} />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Section>

      <Section title="Предметы с долгом по вычитке">
        {hours.data && debts.length === 0 ? <EmptyState>Долгов нет</EmptyState> : null}
        {debts.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Группа</Th>
                <Th>Предмет</Th>
                <Th>Преподаватель</Th>
                <Th className="text-right">Не хватит к концу семестра</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {debts.map((row) => (
                <tr key={`${row.group.id}:${row.subject.id}`}>
                  <Td>{row.group.name}</Td>
                  <Td>{row.subject.name}</Td>
                  <Td>{row.teacher?.fullName ?? ''}</Td>
                  <Td className="text-right tabular-nums text-danger">
                    {formatHourBalance(row.forecastBalanceHours)}, пар: {Math.ceil(Math.abs(row.forecastBalanceHours) / 2)}
                  </Td>
                  <Td className="text-right">
                    <Button
                      size="small"
                      onClick={() =>
                        setDraft({
                          groupId: row.group.id,
                          subjectId: row.subject.id,
                          teacherId: row.teacher?.id,
                          reason: debtReason,
                        })
                      }
                    >
                      Назначить
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : null}
      </Section>

      {draft ? (
        <ExtraLessonDialog
          draft={draft}
          groups={groups}
          teachers={teachers}
          rooms={rooms}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            reload()
          }}
        />
      ) : null}
    </>
  )
}
