'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { attendanceLabels, attendanceStatuses } from '@/components/journal/journal-labels'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import { formatDisplayDate } from '@/lib/dates'
import type { AttendanceStatus, GradeDto, JournalLessonColumn, JournalStudentRow } from '@/lib/types'

type GradeDialogProps = {
  subjectId: string
  student: JournalStudentRow
  date: string
  lesson: JournalLessonColumn | null
  onClose: () => void
}

const gradeValues = [5, 4, 3, 2]

export function GradeDialog({ subjectId, student, date, lesson, onClose }: GradeDialogProps) {
  const [grades, setGrades] = useState<GradeDto[]>(student.grades.filter((grade) => grade.date === date))
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const currentAttendance = lesson
    ? student.attendance.find((item) => item.date === date && item.scheduleSlotId === lesson.scheduleSlotId)
    : undefined
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus | ''>(currentAttendance?.status ?? '')

  const run = async (action: () => Promise<void>) => {
    setIsSaving(true)
    try {
      await action()
      setError(null)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setIsSaving(false)
    }
  }

  const addGrade = (value: number) =>
    run(async () => {
      const { grade } = await apiFetch<{ grade: GradeDto }>('/api/journal/grade', {
        method: 'POST',
        body: { studentId: student.studentId, subjectId, value, date, comment: comment.trim() || undefined },
      })
      setGrades((current) => [...current, grade])
      setComment('')
    })

  const removeGrade = (gradeId: string) =>
    run(async () => {
      await apiFetch(`/api/journal/grade/${gradeId}`, { method: 'DELETE' })
      setGrades((current) => current.filter((grade) => grade.id !== gradeId))
    })

  const saveAttendance = (status: AttendanceStatus) =>
    run(async () => {
      if (!lesson) {
        return
      }
      await apiFetch('/api/journal/attendance', {
        method: 'POST',
        body: { scheduleSlotId: lesson.scheduleSlotId, date, records: [{ studentId: student.studentId, status }] },
      })
      setAttendanceStatus(status)
    })

  return (
    <Dialog title={`${student.fullName} · ${formatDisplayDate(date)}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {error ? <ErrorState message={error} /> : null}

        <div>
          <p className="mb-1 text-caption text-muted">Оценки за день</p>
          {grades.length === 0 ? <p className="text-muted">Нет оценок</p> : null}
          {grades.map((grade) => (
            <div key={grade.id} className="flex items-center gap-2 border-b border-line py-1 last:border-b-0">
              <span className={`w-5 font-medium tabular-nums ${grade.value <= 2 ? 'text-danger' : ''}`}>
                {grade.value}
              </span>
              <span className="flex-1 truncate text-caption text-muted">{grade.comment ?? ''}</span>
              <button
                type="button"
                onClick={() => removeGrade(grade.id)}
                disabled={isSaving}
                aria-label="Удалить оценку"
                className="rounded p-1 text-muted transition-colors hover:bg-subtle hover:text-danger"
              >
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>

        <div>
          <Field label="Комментарий к новой оценке">
            <Input value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} />
          </Field>
          <div className="mt-2 flex gap-2">
            {gradeValues.map((value) => (
              <Button key={value} className="w-10" disabled={isSaving} onClick={() => addGrade(value)}>
                {value}
              </Button>
            ))}
          </div>
        </div>

        {lesson ? (
          <Field label={`Посещаемость, ${lesson.pairNumber} пара`}>
            <Select
              value={attendanceStatus}
              disabled={isSaving}
              onChange={(event) => saveAttendance(event.target.value as AttendanceStatus)}
            >
              <option value="" disabled>
                Не отмечено
              </option>
              {attendanceStatuses.map((status) => (
                <option key={status} value={status}>
                  {attendanceLabels[status]}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Готово
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
