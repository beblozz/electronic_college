'use client'

import { useMemo, useState } from 'react'
import { AttendanceDialog } from '@/components/journal/attendance-dialog'
import { GradeDialog } from '@/components/journal/grade-dialog'
import { attendanceMarks } from '@/components/journal/journal-labels'
import { Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { useApi } from '@/lib/client/api'
import { formatShortDate, shiftDate, todayLocal } from '@/lib/dates'
import type { Journal, JournalLessonColumn, JournalStudentRow } from '@/lib/types'

type JournalColumn = { key: string; date: string; lesson: JournalLessonColumn | null; showsGrades: boolean }

type SelectedCell = { student: JournalStudentRow; column: JournalColumn }

const defaultPeriodDays = 30

function buildColumns(journal: Journal): JournalColumn[] {
  return journal.dates.flatMap((date): JournalColumn[] => {
    const lessons = journal.lessons.filter((lesson) => lesson.date === date)
    if (lessons.length === 0) {
      return [{ key: date, date, lesson: null, showsGrades: true }]
    }
    return lessons.map((lesson, index) => ({
      key: `${date}:${lesson.scheduleSlotId}`,
      date,
      lesson,
      showsGrades: index === 0,
    }))
  })
}

export function JournalView({ groupId, subjectId }: { groupId: string; subjectId: string }) {
  const [to, setTo] = useState(() => todayLocal())
  const [from, setFrom] = useState(() => shiftDate(todayLocal(), -defaultPeriodDays))
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [attendanceColumn, setAttendanceColumn] = useState<JournalColumn | null>(null)

  const journal = useApi<Journal>(`/api/journal/group/${groupId}/subject/${subjectId}?from=${from}&to=${to}`)
  const columns = useMemo(() => (journal.data ? buildColumns(journal.data) : []), [journal.data])

  const closeDialogs = () => {
    setSelectedCell(null)
    setAttendanceColumn(null)
    journal.reload()
  }

  return (
    <>
      <PageHeader
        title={journal.data ? `${journal.data.subject.name} · ${journal.data.group.name}` : 'Журнал'}
        caption="Нажмите на ячейку, чтобы выставить оценку, или на дату, чтобы отметить посещаемость"
      >
        <Field label="С">
          <Input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
        </Field>
        <Field label="По">
          <Input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
        </Field>
      </PageHeader>

      {journal.error ? <ErrorState message={journal.error} /> : null}
      {!journal.data && journal.isLoading ? <LoadingState /> : null}
      {journal.data && journal.data.students.length === 0 ? <EmptyState>В группе нет студентов</EmptyState> : null}

      {journal.data && journal.data.students.length > 0 ? (
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
                        title="Отметить посещаемость"
                        className="block w-full px-2 py-1.5 tabular-nums text-muted transition-colors hover:bg-line hover:text-ink"
                      >
                        {formatShortDate(column.date)}
                        <span className="block text-muted">{column.lesson.pairNumber} п.</span>
                      </button>
                    ) : (
                      <span className="block px-2 py-1.5 tabular-nums text-muted">{formatShortDate(column.date)}</span>
                    )}
                  </th>
                ))}
                <th className="border-b border-line bg-subtle px-3 py-1.5 text-right text-caption font-medium text-muted">
                  Средний
                </th>
              </tr>
            </thead>
            <tbody>
              {journal.data.students.map((student) => (
                <tr key={student.studentId}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-line bg-surface px-3 py-1">
                    {student.fullName}
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
                          {grades.map((grade) => (
                            <span key={grade.id} className={`mx-0.5 font-medium ${grade.value <= 2 ? 'text-danger' : ''}`}>
                              {grade.value}
                            </span>
                          ))}
                          {mark ? <span className="mx-0.5 text-danger">{mark}</span> : null}
                        </button>
                      </td>
                    )
                  })}
                  <td className="border-b border-line px-3 py-1 text-right tabular-nums">
                    {student.averageGrade?.toFixed(2) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {journal.data && columns.length === 0 && journal.data.students.length > 0 ? (
        <p className="mt-2 text-caption text-muted">За выбранный период занятий по предмету не было.</p>
      ) : null}

      {selectedCell ? (
        <GradeDialog
          subjectId={subjectId}
          student={selectedCell.student}
          date={selectedCell.column.date}
          lesson={selectedCell.column.lesson}
          onClose={closeDialogs}
        />
      ) : null}
      {attendanceColumn?.lesson && journal.data ? (
        <AttendanceDialog lesson={attendanceColumn.lesson} students={journal.data.students} onClose={closeDialogs} />
      ) : null}
    </>
  )
}
