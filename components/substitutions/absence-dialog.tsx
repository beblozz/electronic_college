'use client'

import { FormEvent, useState } from 'react'
import { text, useDirectory } from '@/components/admin/use-directory'
import { reasonLabels, reasons } from '@/components/substitutions/reason-labels'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import { todayLocal } from '@/lib/dates'
import type { AbsenceReason } from '@/lib/types'

export function AbsenceDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const teachers = useDirectory('teachers')
  const [teacherId, setTeacherId] = useState('')
  const [reason, setReason] = useState<AbsenceReason>('SICK')
  const [startDate, setStartDate] = useState(() => todayLocal())
  const [endDate, setEndDate] = useState(() => todayLocal())
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await apiFetch('/api/admin/absences', { method: 'POST', body: { teacherId, reason, startDate, endDate } })
      onSaved()
    } catch (failure) {
      setError(errorText(failure))
      setIsSaving(false)
    }
  }

  return (
    <Dialog title="Отсутствие преподавателя" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error ? <ErrorState message={error} /> : null}
        <Field label="Преподаватель">
          <Select value={teacherId} required onChange={(event) => setTeacherId(event.target.value)}>
            <option value="">Выберите</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {text(teacher, 'fullName')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Причина">
          <Select value={reason} onChange={(event) => setReason(event.target.value as AbsenceReason)}>
            {reasons.map((value) => (
              <option key={value} value={value}>
                {reasonLabels[value]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="С">
            <Input type="date" required value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="По">
            <Input
              type="date"
              required
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            Сохранить
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
