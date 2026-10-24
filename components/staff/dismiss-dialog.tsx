'use client'

import { FormEvent, useState } from 'react'
import { dismissalReasonLabels, dismissalReasonOrder } from '@/components/staff/staff-labels'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import { todayLocal } from '@/lib/dates'
import type { DismissalReason, StaffMember } from '@/lib/types'

type DismissDialogProps = { member: StaffMember; onClose: () => void; onSaved: () => void }

function linkedWork(member: StaffMember): string[] {
  const lines: string[] = []
  if (member.gridSlotCount > 0) {
    lines.push(`пар в сетке расписания: ${member.gridSlotCount}`)
  }
  if (member.curriculumCount > 0) {
    lines.push(`записей в учебном плане: ${member.curriculumCount}`)
  }
  if (member.curatedGroupNames.length > 0) {
    lines.push(`куратор групп: ${member.curatedGroupNames.join(', ')}`)
  }
  return lines
}

export function DismissDialog({ member, onClose, onSaved }: DismissDialogProps) {
  const [date, setDate] = useState(todayLocal())
  const [reason, setReason] = useState<DismissalReason>('OWN_WISH')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const work = linkedWork(member)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await apiFetch(`/api/admin/staff/${member.id}/dismiss`, {
        method: 'POST',
        body: { date, reason, note: note.trim() || undefined },
      })
      onSaved()
    } catch (failure) {
      setError(errorText(failure))
      setIsSaving(false)
    }
  }

  return (
    <Dialog title={`Перевести в архив: ${member.fullName}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error ? <ErrorState message={error} /> : null}
        <div className="grid grid-cols-[150px_1fr] gap-3">
          <Field label="Дата увольнения">
            <Input type="date" required value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Причина">
            <Select value={reason} onChange={(event) => setReason(event.target.value as DismissalReason)}>
              {dismissalReasonOrder.map((item) => (
                <option key={item} value={item}>
                  {dismissalReasonLabels[item]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Комментарий">
          <Input
            value={note}
            maxLength={300}
            placeholder="Например, номер приказа"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        {work.length > 0 ? (
          <div className="rounded border border-line bg-subtle px-3 py-2 text-caption">
            <p className="font-medium text-ink">За преподавателем ещё закреплено:</p>
            <ul className="mt-1 text-muted">
              {work.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-1 text-muted">
              После перевода в архив назначьте другого преподавателя в «Расписании» и «Справочниках». Замены на этого
              преподавателя подбираться не будут.
            </p>
          </div>
        ) : null}
        <p className="text-caption text-muted">
          Оценки, посещаемость и история замен сохранятся. Войти в систему преподаватель не сможет. Из архива его можно
          восстановить.
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="danger" disabled={isSaving}>
            В архив
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
