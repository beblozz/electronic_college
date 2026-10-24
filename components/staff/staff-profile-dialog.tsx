'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import { todayLocal } from '@/lib/dates'
import { experienceBetween, formatExperience } from '@/lib/staff/experience'
import type { StaffMember } from '@/lib/types'

type StaffProfileDialogProps = { member: StaffMember; onClose: () => void; onSaved: () => void }

export function StaffProfileDialog({ member, onClose, onSaved }: StaffProfileDialogProps) {
  const [hiredAt, setHiredAt] = useState(member.hiredAt ?? '')
  const [experienceStartDate, setExperienceStartDate] = useState(member.experienceStartDate ?? '')
  const [hasHigherEducation, setHasHigherEducation] = useState(member.hasHigherEducation)
  const [education, setEducation] = useState(member.education ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const today = todayLocal()
  const experienceStart = experienceStartDate || hiredAt

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await apiFetch(`/api/admin/staff/${member.id}`, {
        method: 'PATCH',
        body: {
          hiredAt: hiredAt || null,
          experienceStartDate: experienceStartDate || null,
          hasHigherEducation,
          education: education.trim() || null,
        },
      })
      onSaved()
    } catch (failure) {
      setError(errorText(failure))
      setIsSaving(false)
    }
  }

  return (
    <Dialog title={member.fullName} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error ? <ErrorState message={error} /> : null}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Работает в колледже с">
            <Input type="date" max={today} value={hiredAt} onChange={(event) => setHiredAt(event.target.value)} />
          </Field>
          <Field label="Педагогический стаж с">
            <Input
              type="date"
              max={today}
              value={experienceStartDate}
              onChange={(event) => setExperienceStartDate(event.target.value)}
            />
          </Field>
        </div>
        <p className="text-caption text-muted">
          Стаж: {formatExperience(experienceStart ? experienceBetween(experienceStart, today) : null)}, в колледже:{' '}
          {formatExperience(hiredAt ? experienceBetween(hiredAt, today) : null)}. Если начало стажа не указано, он
          считается с даты приёма.
        </p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-accent"
            checked={hasHigherEducation}
            onChange={(event) => setHasHigherEducation(event.target.checked)}
          />
          Высшее образование
        </label>
        <Field label="Образование: учебное заведение, специальность">
          <Input value={education} maxLength={300} onChange={(event) => setEducation(event.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            Сохранить
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
