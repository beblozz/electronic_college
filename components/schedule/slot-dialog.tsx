'use client'

import { FormEvent, useState } from 'react'
import { DirectoryRow, text } from '@/components/admin/use-directory'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { ApiClientError, apiFetch, errorText } from '@/lib/client/api'
import { weekdayNames } from '@/lib/dates'
import { timesForPair } from '@/lib/schedule/pair-times'
import type { ScheduleConflict, ScheduleSlotView, WeekType } from '@/lib/types'

export type SlotDraft = { dayOfWeek: number; pairNumber: number; slot: ScheduleSlotView | null }

type SlotDialogProps = {
  draft: SlotDraft
  groupId: string
  semester: number
  curricula: DirectoryRow[]
  teachers: DirectoryRow[]
  rooms: DirectoryRow[]
  onClose: () => void
  onSaved: () => void
}

const weekTypeLabels: Record<WeekType, string> = {
  BOTH: 'Каждую неделю',
  ODD: 'Нечётные недели',
  EVEN: 'Чётные недели',
}

export function SlotDialog({ draft, groupId, semester, curricula, teachers, rooms, onClose, onSaved }: SlotDialogProps) {
  const { slot, dayOfWeek, pairNumber } = draft
  const defaultTimes = timesForPair(pairNumber)
  const [subjectId, setSubjectId] = useState(slot?.subjectId ?? text(curricula[0], 'subjectId'))
  const [teacherId, setTeacherId] = useState(slot?.teacherId ?? text(curricula[0], 'teacherId'))
  const [roomId, setRoomId] = useState(slot?.roomId ?? text(rooms[0], 'id'))
  const [weekType, setWeekType] = useState<WeekType>(slot?.weekType ?? 'BOTH')
  const [startTime, setStartTime] = useState(slot?.startTime ?? defaultTimes.startTime)
  const [endTime, setEndTime] = useState(slot?.endTime ?? defaultTimes.endTime)
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const qualifiedTeachers = teachers.filter(
    (teacher) => Array.isArray(teacher.subjectIds) && (teacher.subjectIds as string[]).includes(subjectId),
  )

  const selectSubject = (nextSubjectId: string) => {
    setSubjectId(nextSubjectId)
    const curriculum = curricula.find((item) => text(item, 'subjectId') === nextSubjectId)
    setTeacherId(text(curriculum, 'teacherId'))
  }

  const handleFailure = (reason: unknown) => {
    const details = reason instanceof ApiClientError ? (reason.details as { conflicts?: ScheduleConflict[] }) : {}
    setConflicts(details.conflicts ?? [])
    setError(errorText(reason))
    setIsSaving(false)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    const body = { groupId, subjectId, teacherId, roomId, dayOfWeek, pairNumber, startTime, endTime, weekType, semester }
    try {
      await apiFetch(slot ? `/api/schedule/${slot.id}` : '/api/schedule', { method: slot ? 'PATCH' : 'POST', body })
      onSaved()
    } catch (reason) {
      handleFailure(reason)
    }
  }

  const remove = async () => {
    if (!slot) {
      return
    }
    setIsSaving(true)
    try {
      await apiFetch(`/api/schedule/${slot.id}`, { method: 'DELETE' })
      onSaved()
    } catch (reason) {
      handleFailure(reason)
    }
  }

  return (
    <Dialog title={`${weekdayNames[dayOfWeek - 1]}, ${pairNumber} пара`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error && conflicts.length === 0 ? <ErrorState message={error} /> : null}
        {conflicts.length > 0 ? (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-danger">
            <p className="font-medium">Конфликт расписания</p>
            {conflicts.map((conflict, index) => (
              <p key={index}>{conflict.message}</p>
            ))}
          </div>
        ) : null}
        {curricula.length === 0 ? (
          <p className="text-muted">В учебном плане группы на этот семестр нет предметов. Добавьте их в справочнике.</p>
        ) : null}

        <Field label="Предмет">
          <Select value={subjectId} required onChange={(event) => selectSubject(event.target.value)}>
            {curricula.map((curriculum) => (
              <option key={curriculum.id} value={text(curriculum, 'subjectId')}>
                {text(curriculum, 'subjectName')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Преподаватель">
          <Select value={teacherId} required onChange={(event) => setTeacherId(event.target.value)}>
            <option value="">Выберите</option>
            {qualifiedTeachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {text(teacher, 'fullName')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Аудитория">
          <Select value={roomId} required onChange={(event) => setRoomId(event.target.value)}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {text(room, 'number')}, {text(room, 'building')}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Недели" className="col-span-2">
            <Select value={weekType} onChange={(event) => setWeekType(event.target.value as WeekType)}>
              {(Object.keys(weekTypeLabels) as WeekType[]).map((value) => (
                <option key={value} value={value}>
                  {weekTypeLabels[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Начало">
            <Input type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </Field>
          <Field label="Конец">
            <Input type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </Field>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          {slot ? (
            <Button variant="danger" disabled={isSaving} onClick={remove}>
              Удалить
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button onClick={onClose}>Отмена</Button>
            <Button type="submit" variant="primary" disabled={isSaving || curricula.length === 0}>
              Сохранить
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
