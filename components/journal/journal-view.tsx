'use client'

import { useMemo, useState } from 'react'
import { AttendanceDialog } from '@/components/journal/attendance-dialog'
import { GradeDialog } from '@/components/journal/grade-dialog'
import { formatPairBalance } from '@/components/hours/hours-format'
import { InsightsPanel } from '@/components/journal/insights-panel'
import { attendanceMarks, gradeKindLabels } from '@/components/journal/journal-labels'
import { PlanDialog } from '@/components/journal/plan-dialog'
import { PlanStatus } from '@/components/journal/plan-status'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { useApi } from '@/lib/client/api'
import { formatDisplayDate, formatShortDate } from '@/lib/dates'
import type {
  GradeDto,
  Journal,
  JournalLessonColumn,
  JournalScope,
  JournalStudentRow,
  StudyPlanItemDto,
} from '@/lib/types'

type JournalColumn = {
  key: string
  date: string
  lesson: JournalLessonColumn | null
  showsGrades: boolean
  planItem: StudyPlanItemDto | null
}

type SelectedCell = { student: JournalStudentRow; column: JournalColumn }

function buildColumns(journal: Journal): JournalColumn[] {
  return journal.dates.flatMap((date): JournalColumn[] => {
    const lessons = journal.lessons.filter((lesson) => lesson.date === date)
    const planItem = journal.plan.items.find((item) => item.plannedDate === date) ?? null
    if (lessons.length === 0) {
      return [{ key: date, date, lesson: null, showsGrades: true, planItem }]
    }
    return lessons.map((lesson, index) => ({
      key: `${date}:${lesson.scheduleSlotId}`,
      date,
      lesson,
      showsGrades: index === 0,
      planItem: index === 0 ? planItem : null,
    }))
  })
}

function planItemShortLabel(item: StudyPlanItemDto, journal: Journal): string {
  const number = journal.plan.items.filter((candidate) => candidate.kind === item.kind && candidate.position <= item.position).length
  return item.kind === 'LECTURE' ? `Л${number}` : `ПР${number}`
}

function gradeTitle(grade: GradeDto, journal: Journal): string {
  const planItem = journal.plan.items.find((item) => item.id === grade.planItemId)
  return [
    `${grade.value} — ${gradeKindLabels[grade.kind]}${planItem ? `: ${planItem.title}` : ''}`,
    formatDisplayDate(grade.date),
    grade.teacher.fullName,
    grade.comment ?? '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function rowTone(student: JournalStudentRow): string {
  if (student.insight.isLagging) {
    return 'bg-loadHigh'
  }
  return student.insight.needsAttention ? 'bg-loadMedium' : 'bg-surface'
}

function journalCaption(journal: Journal): string {
  const parts: string[] = []
  if (journal.teachers.length > 0) {
    parts.push(`Ведут: ${journal.teachers.map((teacher) => teacher.fullName).join(', ')}`)
  }
  const hours = journal.programHours
  if (hours) {
    const balance = hours.balancePairsToDate === 0 ? 'по сетке' : formatPairBalance(hours.balancePairsToDate)
    parts.push(`Вычитка: ${hours.conductedHoursToDate} из ${hours.plannedHours} ч (${balance})`)
  }
  return parts.join(' · ')
}

const scopeLabels: Record<JournalScope, string> = { mine: 'Моя часть', all: 'Общий журнал' }

export function JournalView({ groupId, subjectId }: { groupId: string; subjectId: string }) {
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null)
  const [scope, setScope] = useState<JournalScope>('mine')
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [attendanceColumn, setAttendanceColumn] = useState<JournalColumn | null>(null)
  const [isPlanOpen, setIsPlanOpen] = useState(false)

  const params = new URLSearchParams({ scope })
  if (period) {
    params.set('from', period.from)
    params.set('to', period.to)
  }
  const journal = useApi<Journal>(`/api/journal/group/${groupId}/subject/${subjectId}?${params.toString()}`)
  const data = journal.data
  const columns = useMemo(() => (data ? buildColumns(data) : []), [data])
  const hasSeveralTeachers = Boolean(data?.viewerTeacherId && data.teachers.length > 1)

  const closeDialogs = () => {
    setSelectedCell(null)
    setAttendanceColumn(null)
    setIsPlanOpen(false)
    journal.reload()
  }

  const changePeriod = (changes: Partial<{ from: string; to: string }>) => {
    if (data) {
      setPeriod({ from: data.from, to: data.to, ...changes })
    }
  }

  return (
    <>
      <PageHeader
        title={data ? `${data.subject.name} · ${data.group.name}` : 'Журнал'}
        caption={data ? journalCaption(data) : undefined}
      >
        {hasSeveralTeachers ? (
          <div className="flex rounded border border-line p-0.5">
            {(Object.keys(scopeLabels) as JournalScope[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setScope(item)}
                className={`rounded px-2.5 py-1 transition-colors ${
                  scope === item ? 'bg-subtle font-medium text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                {scopeLabels[item]}
              </button>
            ))}
          </div>
        ) : null}
        {data ? (
          <Button onClick={() => setIsPlanOpen(true)} disabled={!data.canEditPlan}>
            КТП: {data.plan.items.length} {data.plan.items.length === 0 ? '(не заполнен)' : 'работ'}
          </Button>
        ) : null}
        <Field label="С">
          <Input type="date" value={data?.from ?? ''} max={data?.to} onChange={(event) => changePeriod({ from: event.target.value })} />
        </Field>
        <Field label="По">
          <Input type="date" value={data?.to ?? ''} min={data?.from} onChange={(event) => changePeriod({ to: event.target.value })} />
        </Field>
      </PageHeader>

      {journal.error ? <ErrorState message={journal.error} /> : null}
      {!data && journal.isLoading ? <LoadingState /> : null}
      {data && data.students.length === 0 ? <EmptyState>В группе нет студентов</EmptyState> : null}

      {data && data.students.length > 0 ? (
        <>
          <InsightsPanel journal={data} />
          <div className="inline-block max-w-full overflow-x-auto rounded border border-line align-top">
            <table className="border-collapse text-body [&_tbody_tr:last-child_td]:border-b-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-48 border-b border-r border-line bg-subtle px-3 py-1.5 text-left text-caption font-medium text-muted">
                    Студент
                  </th>
                  {columns.map((column) => (
                    <th key={column.key} className="border-b border-r border-line bg-subtle p-0 text-caption font-medium">
                      {column.lesson ? (
                        <button
                          type="button"
                          onClick={() => setAttendanceColumn(column)}
                          title={[
                            `Отметить посещаемость. Ведёт: ${column.lesson.teacher.fullName}`,
                            column.planItem ? `По КТП: ${column.planItem.title}` : '',
                          ]
                            .filter(Boolean)
                            .join('. ')}
                          className="block w-full px-2 py-1.5 tabular-nums text-muted transition-colors hover:bg-line hover:text-ink"
                        >
                          {formatShortDate(column.date)}
                          <span className="block text-muted">{column.lesson.pairNumber} п.</span>
                          {column.planItem ? (
                            <span className="block text-accent">{planItemShortLabel(column.planItem, data)}</span>
                          ) : null}
                        </button>
                      ) : (
                        <span
                          title={column.planItem ? `По КТП: ${column.planItem.title}` : undefined}
                          className="block px-2 py-1.5 tabular-nums text-muted"
                        >
                          {formatShortDate(column.date)}
                          {column.planItem ? (
                            <span className="block text-accent">{planItemShortLabel(column.planItem, data)}</span>
                          ) : null}
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="border-b border-r border-line bg-subtle px-3 py-1.5 text-right text-caption font-medium text-muted">
                    Средний
                  </th>
                  <th className="border-b border-line bg-subtle px-3 py-1.5 text-left text-caption font-medium text-muted">
                    КТП
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((student) => (
                  <tr key={student.studentId}>
                    <td
                      title={student.insight.reasons.join('; ')}
                      className={`sticky left-0 z-10 whitespace-nowrap border-b border-r border-line px-3 py-1 ${rowTone(student)}`}
                    >
                      {student.fullName}
                      {student.insight.isLagging ? <span className="ml-2 text-caption text-danger">отстаёт</span> : null}
                      {student.insight.needsAttention ? (
                        <span className="ml-2 text-caption text-amber-700">мало оценок</span>
                      ) : null}
                    </td>
                    {columns.map((column) => {
                      const grades = column.showsGrades
                        ? student.grades.filter((grade) => grade.date === column.date)
                        : []
                      const attendance = column.lesson
                        ? student.attendance.find(
                            (item) =>
                              item.date === column.date && item.scheduleSlotId === column.lesson?.scheduleSlotId,
                          )
                        : undefined
                      const mark = attendance ? attendanceMarks[attendance.status] : ''
                      return (
                        <td key={column.key} className="border-b border-r border-line p-0 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedCell({ student, column })}
                            className="block h-7 w-full min-w-12 px-1 tabular-nums transition-colors hover:bg-subtle"
                          >
                            {grades.map((grade) => {
                              const isForeign = Boolean(data.viewerTeacherId && grade.teacher.id !== data.viewerTeacherId)
                              const tone = grade.value <= 2 ? 'text-danger' : isForeign ? 'text-muted' : ''
                              return (
                                <span
                                  key={grade.id}
                                  title={gradeTitle(grade, data)}
                                  className={`mx-0.5 font-medium ${tone} ${grade.planItemId ? 'underline decoration-dotted underline-offset-2' : ''}`}
                                >
                                  {grade.value}
                                </span>
                              )
                            })}
                            {mark ? <span className="mx-0.5 text-danger">{mark}</span> : null}
                          </button>
                        </td>
                      )
                    })}
                    <td className="border-b border-r border-line px-3 py-1 text-right tabular-nums">
                      {student.averageGrade?.toFixed(2) ?? '—'}
                    </td>
                    <td className="border-b border-line px-3 py-1">
                      <PlanStatus progress={student.plan} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-caption text-muted">
            Подчёркнутые оценки привязаны к работе из КТП. Синим под датой — работа по КТП (Л — лекция, ПР — практическая): оценка в этот день привязывается к ней автоматически. Серым — оценки других преподавателей. Красная строка — отстаёт,
            жёлтая — мало оценок по сравнению с группой; причина во всплывающей подсказке у фамилии.
          </p>
        </>
      ) : null}

      {data && columns.length === 0 && data.students.length > 0 ? (
        <p className="mt-2 text-caption text-muted">За выбранный период занятий по предмету не было.</p>
      ) : null}

      {selectedCell && data ? (
        <GradeDialog
          subjectId={subjectId}
          student={selectedCell.student}
          date={selectedCell.column.date}
          lesson={selectedCell.column.lesson}
          plan={data.plan}
          viewerTeacherId={data.viewerTeacherId}
          onClose={closeDialogs}
        />
      ) : null}
      {attendanceColumn?.lesson && data ? (
        <AttendanceDialog lesson={attendanceColumn.lesson} students={data.students} onClose={closeDialogs} />
      ) : null}
      {isPlanOpen && data ? (
        <PlanDialog groupId={groupId} subjectId={subjectId} plan={data.plan} onClose={() => setIsPlanOpen(false)} onSaved={closeDialogs} />
      ) : null}
    </>
  )
}
