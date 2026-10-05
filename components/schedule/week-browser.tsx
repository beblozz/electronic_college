'use client'

import { useEffect, useState } from 'react'
import { text, useDirectory } from '@/components/admin/use-directory'
import { useSocketEvent } from '@/components/layout/realtime-provider'
import { WeekNavigator } from '@/components/schedule/week-navigator'
import { WeekSchedule } from '@/components/schedule/week-schedule'
import { Field, Select } from '@/components/ui/field'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { useApi } from '@/lib/client/api'
import { shiftDate, todayLocal, weekStartOf } from '@/lib/dates'
import type { Lesson } from '@/lib/types'

type FilterKind = 'groupId' | 'teacherId' | 'roomId'

const filterKinds: Array<{ kind: FilterKind; label: string; resource: string }> = [
  { kind: 'groupId', label: 'Группа', resource: 'groups' },
  { kind: 'teacherId', label: 'Преподаватель', resource: 'teachers' },
  { kind: 'roomId', label: 'Аудитория', resource: 'rooms' },
]

const optionLabelKeys: Record<FilterKind, string> = { groupId: 'name', teacherId: 'fullName', roomId: 'number' }

export function WeekBrowser() {
  const [kind, setKind] = useState<FilterKind>('groupId')
  const [entityId, setEntityId] = useState('')
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayLocal()))
  const selectedKind = filterKinds.find((item) => item.kind === kind) ?? filterKinds[0]
  const options = useDirectory(selectedKind.resource)

  useEffect(() => {
    if (options.length > 0 && !options.some((option) => option.id === entityId)) {
      setEntityId(options[0].id)
    }
  }, [options, entityId])

  const isReady = options.some((option) => option.id === entityId)
  const schedule = useApi<{ lessons: Lesson[] }>(
    isReady ? `/api/schedule?${kind}=${entityId}&from=${weekStart}&to=${shiftDate(weekStart, 6)}` : null,
  )
  useSocketEvent('substitution:created', schedule.reload)

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Показать по" className="w-40">
          <Select value={kind} onChange={(event) => setKind(event.target.value as FilterKind)}>
            {filterKinds.map((item) => (
              <option key={item.kind} value={item.kind}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={selectedKind.label} className="w-56">
          <Select value={entityId} onChange={(event) => setEntityId(event.target.value)}>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {text(option, optionLabelKeys[kind])}
              </option>
            ))}
          </Select>
        </Field>
        <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />
      </div>
      {schedule.error ? <ErrorState message={schedule.error} /> : null}
      {schedule.data ? (
        <WeekSchedule
          lessons={schedule.data.lessons}
          weekStart={weekStart}
          perspective={kind === 'groupId' ? 'group' : 'full'}
        />
      ) : (
        <LoadingState />
      )}
    </>
  )
}
