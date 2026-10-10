'use client'

import { FormEvent, useMemo, useState } from 'react'
import { DirectoryRow, text, useDirectory } from '@/components/admin/use-directory'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { ApiClientError, apiFetch, errorText, useApi } from '@/lib/client/api'
import { dayOfWeek, parseDate, shiftDate, todayLocal } from '@/lib/dates'
import { pairTimes } from '@/lib/schedule/pair-times'
import type { Lesson, ScheduleConflict } from '@/lib/types'

export type ExtraLessonDraft = { groupId?: string; subjectId?: string; teacherId?: string; reason?: string }

type ExtraLessonDialogProps = {
  draft: ExtraLessonDraft
  groups: DirectoryRow[]
  teachers: DirectoryRow[]
  rooms: DirectoryRow[]
  onClose: () => void
  onSaved: () => void
}

const sunday = 7

function nextStudyDay(): string {
  const tomorrow = shiftDate(todayLocal(), 1)
  return dayOfWeek(parseDate(tomorrow)) === sunday ? shiftDate(tomorrow, 1) : tomorrow
}

function busyLabel(lessons: Lesson[], pairNumber: number, describe: (lesson: Lesson) => string): string | null {
  const lesson = lessons.find((candidate) => candidate.pairNumber === pairNumber)
  return lesson ? describe(lesson) : null
}

export function ExtraLessonDialog({ draft, groups, teachers, rooms, onClose, onSaved }: ExtraLessonDialogProps) {
  const [groupId, setGroupId] = useState(draft.groupId ?? text(groups[0], 'id'))
  const [subjectId, setSubjectId] = useState(draft.subjectId ?? '')
  const [teacherId, setTeacherId] = useState(draft.teacherId ?? '')
  const [roomId, setRoomId] = useState(text(rooms[0], 'id'))
  const [date, setDate] = useState(nextStudyDay)
  const [pairNumber, setPairNumber] = useState(0)
  const [reason, setReason] = useState(draft.reason ?? '')
  const [error, setError] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const curricula = useDirectory(groupId ? 'curricula' : null, `&groupId=${groupId}`)
  const subjects = useMemo(() => {
    const unique = new Map<string, string>()
    for (const curriculum of curricula) {
      unique.set(text(curriculum, 'subjectId'), text(curriculum, 'subjectName'))
    }
    return [...unique.entries()].sort((first, second) => first[1].localeCompare(second[1], 'ru'))
  }, [curricula])
  const activeSubjectId = subjectId || subjects[0]?.[0] || ''
  const qualifiedTeachers = teachers.filter(
    (teacher) => Array.isArray(teacher.subjectIds) && (teacher.subjectIds as string[]).includes(activeSubjectId),
  )
  const curriculumTeacherId = text(
    curricula.find((curriculum) => text(curriculum, 'subjectId') === activeSubjectId),
    'teacherId',
  )
  const activeTeacherId = teacherId || curriculumTeacherId

  const groupLessons = useApi<{ lessons: Lesson[] }>(
    groupId && date ? `/api/schedule?groupId=${groupId}&from=${date}&to=${date}` : null,
  )
  const teacherLessons = useApi<{ lessons: Lesson[] }>(
    activeTeacherId && date ? `/api/schedule?teacherId=${activeTeacherId}&from=${date}&to=${date}` : null,
  )
  const pairOptions = pairTimes.map((pair) => {
    const groupBusy = busyLabel(groupLessons.data?.lessons ?? [], pair.pairNumber, (lesson) => `у группы ${lesson.subject.name}`)
    const teacherBusy = busyLabel(
      teacherLessons.data?.lessons ?? [],
      pair.pairNumber,
      (lesson) => `преподаватель ведёт у ${lesson.group.name}`,
    )
    return { ...pair, note: groupBusy ?? teacherBusy }
  })
  const firstFreePair = pairOptions.find((pair) => !pair.note)?.pairNumber ?? 1
  const activePair = pairNumber || firstFreePair

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await apiFetch('/api/admin/extra-lessons', {
        method: 'POST',
        body: {
          groupId,
          subjectId: activeSubjectId,
          teacherId: activeTeacherId,
          roomId,
          date,
          pairNumber: activePair,
          reason: reason.trim() || undefined,
        },
      })
      onSaved()
    } catch (reasonOfFailure) {
      const details =
        reasonOfFailure instanceof ApiClientError ? (reasonOfFailure.details as { conflicts?: ScheduleConflict[] }) : {}
      setConflicts(details.conflicts ?? [])
      setError(errorText(reasonOfFailure))
      setIsSaving(false)
    }
  }

  return (
    <Dialog title="Дополнительная пара" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error && conflicts.length === 0 ? <ErrorState message={error} /> : null}
        {conflicts.length > 0 ? (
          <div role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-danger">
            <p className="font-medium">Время занято</p>
            {conflicts.map((conflict, index) => (
              <p key={index}>{conflict.message}</p>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Группа">
            <Select
              value={groupId}
              required
              onChange={(event) => {
                setGroupId(event.target.value)
                setSubjectId('')
                setTeacherId('')
              }}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {text(group, 'name')}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дата">
            <Input
              type="date"
              required
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setPairNumber(0)
              }}
            />
          </Field>
        </div>
        <Field label="Предмет">
          <Select
            value={activeSubjectId}
            required
            onChange={(event) => {
              setSubjectId(event.target.value)
              setTeacherId('')
            }}
          >
            {subjects.length === 0 ? <option value="">В учебном плане группы нет предметов</option> : null}
            {subjects.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Преподаватель">
          <Select value={activeTeacherId} required onChange={(event) => setTeacherId(event.target.value)}>
            <option value="">Выберите</option>
            {qualifiedTeachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {text(teacher, 'fullName')}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Пара">
            <Select value={activePair} onChange={(event) => setPairNumber(Number(event.target.value))}>
              {pairOptions.map((pair) => (
                <option key={pair.pairNumber} value={pair.pairNumber}>
                  {pair.pairNumber} пара, {pair.startTime}
                  {pair.note ? ` — занято: ${pair.note}` : ''}
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
        </div>
        <Field label="Причина">
          <Input
            value={reason}
            maxLength={200}
            placeholder="Например, отработка долга по вычитке"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <p className="text-caption text-muted">
          Пара появится в расписании группы и преподавателя только в эту дату. Студенты и преподаватель получат
          уведомление. Проведённая доп. пара добавляет часы предмету и закрывает долг по вычитке.
        </p>

        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" disabled={isSaving || !activeSubjectId || !activeTeacherId}>
            Назначить
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
