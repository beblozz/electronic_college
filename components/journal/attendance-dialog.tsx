'use client'

import { useState } from 'react'
import { attendanceLabels, attendanceStatuses } from '@/components/journal/journal-labels'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import { formatDisplayDate } from '@/lib/dates'
import type { AttendanceStatus, JournalLessonColumn, JournalStudentRow } from '@/lib/types'

type AttendanceDialogProps = {
  lesson: JournalLessonColumn
  students: JournalStudentRow[]
  onClose: () => void
}

export function AttendanceDialog({ lesson, students, onClose }: AttendanceDialogProps) {
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
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
      onClose()
    } catch (reason) {
      setError(errorText(reason))
      setIsSaving(false)
    }
  }

  return (
    <Dialog title={`Посещаемость · ${formatDisplayDate(lesson.date)}, ${lesson.pairNumber} пара`} onClose={onClose}>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      <div className="max-h-[50vh] overflow-y-auto rounded border border-line">
        {students.map((student) => (
          <div
            key={student.studentId}
            className="flex items-center justify-between gap-3 border-b border-line px-3 py-1 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate">{student.fullName}</span>
            <Select
              className="!w-48 shrink-0"
              value={statusByStudent[student.studentId]}
              onChange={(event) =>
                setStatusByStudent((current) => ({
                  ...current,
                  [student.studentId]: event.target.value as AttendanceStatus,
                }))
              }
            >
              {attendanceStatuses.map((status) => (
                <option key={status} value={status}>
                  {attendanceLabels[status]}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="primary" disabled={isSaving} onClick={save}>
          Сохранить
        </Button>
      </div>
    </Dialog>
  )
}
