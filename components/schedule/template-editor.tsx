'use client'

import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { text, useDirectory } from '@/components/admin/use-directory'
import { SlotDialog, SlotDraft } from '@/components/schedule/slot-dialog'
import { Badge } from '@/components/ui/badge'
import { Field, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { useApi } from '@/lib/client/api'
import { todayLocal, weekdayNames } from '@/lib/dates'
import { pairTimes } from '@/lib/schedule/pair-times'
import type { ScheduleSlotView } from '@/lib/types'

const editableDays = [1, 2, 3, 4, 5, 6]
const semesterOptions = Array.from({ length: 8 }, (_, index) => index + 1)

export function TemplateEditor() {
  const groups = useDirectory('groups')
  const terms = useDirectory('terms')
  const teachers = useDirectory('teachers')
  const rooms = useDirectory('rooms')
  const [groupId, setGroupId] = useState('')
  const [semester, setSemester] = useState(1)
  const [draft, setDraft] = useState<SlotDraft | null>(null)

  const curricula = useDirectory(groupId ? 'curricula' : null, `&groupId=${groupId}&semester=${semester}`)
  const slots = useApi<{ slots: ScheduleSlotView[] }>(
    groupId ? `/api/schedule/slots?groupId=${groupId}&semester=${semester}` : null,
  )

  const selectGroup = (nextGroupId: string) => {
    setGroupId(nextGroupId)
    const group = groups.find((item) => item.id === nextGroupId)
    const today = todayLocal()
    const currentTerm = terms.find((term) => text(term, 'startDate') <= today && text(term, 'endDate') >= today)
    const termHalf = Number(text(currentTerm, 'half') || 1)
    setSemester((Number(text(group, 'courseYear') || 1) - 1) * 2 + termHalf)
  }

  useEffect(() => {
    if (!groupId && groups.length > 0 && terms.length > 0) {
      selectGroup(groups[0].id)
    }
  }, [groups, terms, groupId])

  const slotsAt = (dayOfWeek: number, pairNumber: number) =>
    (slots.data?.slots ?? []).filter((slot) => slot.dayOfWeek === dayOfWeek && slot.pairNumber === pairNumber)

  return (
    <>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Группа" className="w-44">
          <Select value={groupId} onChange={(event) => selectGroup(event.target.value)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {text(group, 'name')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Семестр" className="w-28">
          <Select value={semester} onChange={(event) => setSemester(Number(event.target.value))}>
            {semesterOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </Field>
        <p className="pb-1.5 text-caption text-muted">Нажмите на пару, чтобы изменить её, или на плюс, чтобы добавить.</p>
      </div>

      {slots.error ? <ErrorState message={slots.error} /> : null}

      <div className="overflow-x-auto rounded border border-line">
        <table className="w-full min-w-[820px] table-fixed border-collapse text-left [&_tbody_tr:last-child_td]:border-b-0">
          <thead>
            <tr>
              <th className="w-20 border-b border-line bg-subtle px-2 py-1.5 text-caption font-medium text-muted">Пара</th>
              {editableDays.map((day) => (
                <th
                  key={day}
                  className="border-b border-l border-line bg-subtle px-2 py-1.5 text-caption font-medium text-muted"
                >
                  {weekdayNames[day - 1]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pairTimes.map((pair) => (
              <tr key={pair.pairNumber}>
                <td className="border-b border-line px-2 py-1 align-top">
                  <span className="font-medium">{pair.pairNumber}</span>
                  <span className="ml-1.5 text-caption tabular-nums text-muted">{pair.startTime}</span>
                </td>
                {editableDays.map((day) => (
                  <td key={day} className="group border-b border-l border-line p-1 align-top">
                    <div className="flex min-h-8 flex-col gap-1">
                      {slotsAt(day, pair.pairNumber).map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => setDraft({ dayOfWeek: day, pairNumber: pair.pairNumber, slot })}
                          className="rounded px-1 py-0.5 text-left transition-colors hover:bg-subtle"
                        >
                          <span className="block font-medium">{slot.subjectName}</span>
                          <span className="block text-caption text-muted">
                            {slot.teacherName} · ауд. {slot.roomLabel.split(',')[0]}
                          </span>
                          {slot.weekType !== 'BOTH' ? (
                            <Badge>{slot.weekType === 'ODD' ? 'нечётная' : 'чётная'}</Badge>
                          ) : null}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-label="Добавить пару"
                        onClick={() => setDraft({ dayOfWeek: day, pairNumber: pair.pairNumber, slot: null })}
                        className="flex h-6 w-6 items-center justify-center rounded text-muted opacity-0 transition-opacity hover:bg-subtle hover:text-ink focus:opacity-100 group-hover:opacity-100"
                      >
                        <Plus size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {draft ? (
        <SlotDialog
          draft={draft}
          groupId={groupId}
          semester={semester}
          curricula={curricula}
          teachers={teachers}
          rooms={rooms}
          onClose={() => setDraft(null)}
          onSaved={() => {
            setDraft(null)
            slots.reload()
          }}
        />
      ) : null}
    </>
  )
}
