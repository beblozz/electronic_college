'use client'

import { useState } from 'react'
import {
  attendanceLabels,
  attendanceStatuses,
  gradeKindForPlanItem,
  gradeKindLabels,
  gradeKinds,
  planItemLabel,
} from '@/components/journal/journal-labels'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import { formatDisplayDate } from '@/lib/dates'
import type {
  AttendanceStatus,
  GradeKind,
  JournalLessonColumn,
  JournalStudentRow,
  StudyPlanDto,
} from '@/lib/types'

type AttendanceDialogProps = {
  lesson: JournalLessonColumn
  students: JournalStudentRow[]
  subjectId: string
  plan: StudyPlanDto
  onClose: () => void
}

const gradeValues = [5, 4, 3, 2]
const absentStatuses: AttendanceStatus[] = ['ABSENT', 'EXCUSED']

export function AttendanceDialog({ lesson, students, subjectId, plan, onClose }: AttendanceDialogProps) {
  const scheduledItem = plan.items.find((item) => item.plannedDate === lesson.date) ?? null
  const [statusByStudent, setStatusByStudent] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(
      students.map((student) => {
        const existing = student.attendance.find(
          (item) => item.date === lesson.date && item.scheduleSlotId === lesson.scheduleSlotId,
        )
        return [student.studentId, existing?.status ?? 'PRESENT']
      }),
    ),
  )
  const [gradeByStudent, setGradeByStudent] = useState<Record<string, number>>({})
  const [kind, setKind] = useState<GradeKind>(scheduledItem ? gradeKindForPlanItem[scheduledItem.kind] : 'ANSWER')
  const [planItemId, setPlanItemId] = useState(scheduledItem?.id ?? '')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const newGradeCount = Object.keys(gradeByStudent).length

  const setStatus = (studentId: string, status: AttendanceStatus) => {
    setStatusByStudent((current) => ({ ...current, [studentId]: status }))
    if (absentStatuses.includes(status)) {
      setGradeByStudent((current) => {
        const next = { ...current }
        delete next[studentId]
        return next
      })
    }
  }

  const toggleGrade = (studentId: string, value: number) =>
    setGradeByStudent((current) => {
      const next = { ...current }
      if (next[studentId] === value) {
        delete next[studentId]
      } else {
        next[studentId] = value
      }
      return next
    })

  const save = async () => {
    setIsSaving(true)
    try {
      await apiFetch('/api/journal/attendance', {
        method: 'POST',
        body: {
          scheduleSlotId: lesson.scheduleSlotId,
          date: lesson.date,
          records: students.map((student) => ({
            studentId: student.studentId,
            status: statusByStudent[student.studentId],
          })),
        },
      })
      for (const [studentId, value] of Object.entries(gradeByStudent)) {
        await apiFetch('/api/journal/grade', {
          method: 'POST',
          body: {
            studentId,
            subjectId,
            value,
            date: lesson.date,
            kind,
            planItemId: planItemId || null,
            comment: comment.trim() || undefined,
          },
        })
        setGradeByStudent((current) => {
          const next = { ...current }
          delete next[studentId]
          return next
        })
      }
      onClose()
    } catch (reason) {
      setError(errorText(reason))
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      title={`Посещаемость и оценки · ${formatDisplayDate(lesson.date)}, ${lesson.pairNumber} пара`}
      width="wide"
      onClose={onClose}
    >
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <Field label="За что оценки">
          <Select value={kind} onChange={(event) => setKind(event.target.value as GradeKind)}>
            {gradeKinds.map((item) => (
              <option key={item} value={item}>
                {gradeKindLabels[item]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Работа из КТП">
          <Select
            value={planItemId}
            onChange={(event) => {
              setPlanItemId(event.target.value)
              const item = plan.items.find((candidate) => candidate.id === event.target.value)
              setKind(item ? gradeKindForPlanItem[item.kind] : 'ANSWER')
            }}
          >
            <option value="">{plan.items.length === 0 ? 'КТП не заполнен' : 'Не привязывать'}</option>
            {plan.items.map((item) => (
              <option key={item.id} value={item.id}>
                {planItemLabel(item)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Комментарий ко всем оценкам">
          <Input value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} />
        </Field>
      </div>

      <div className="max-h-[50vh] overflow-y-auto rounded border border-line">
        {students.map((student) => {
          const status = statusByStudent[student.studentId]
          const isAbsent = absentStatuses.includes(status)
          const existingGrades = student.grades.filter((grade) => grade.date === lesson.date)
          return (
            <div
              key={student.studentId}
              className="flex flex-wrap items-center gap-3 border-b border-line px-3 py-1 last:border-b-0"
            >
              <span className="min-w-40 flex-1 truncate">{student.fullName}</span>
              <span className="w-12 text-caption tabular-nums text-muted" title="Оценки за этот день">
                {existingGrades.map((grade) => grade.value).join(' ')}
              </span>
              <div className="flex gap-1">
                {gradeValues.map((value) => {
                  const isSelected = gradeByStudent[student.studentId] === value
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={isAbsent}
                      aria-pressed={isSelected}
                      onClick={() => toggleGrade(student.studentId, value)}
                      className={`h-8 w-8 rounded border tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        isSelected
                          ? value <= 2
                            ? 'border-danger bg-danger text-white'
                            : 'border-accent bg-accent text-white'
                          : 'border-line hover:bg-subtle'
                      }`}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>
              <Select
                className="!w-44 shrink-0"
                value={status}
                onChange={(event) => setStatus(student.studentId, event.target.value as AttendanceStatus)}
              >
                {attendanceStatuses.map((item) => (
                  <option key={item} value={item}>
                    {attendanceLabels[item]}
                  </option>
                ))}
              </Select>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-caption text-muted">
          {newGradeCount > 0 ? `Новых оценок: ${newGradeCount}. ` : ''}
          {scheduledItem ? `По КТП на эту дату: ${planItemLabel(scheduledItem)}.` : 'Повторное нажатие снимает оценку.'}
        </span>
        <div className="flex gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" disabled={isSaving} onClick={save}>
            Сохранить
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
