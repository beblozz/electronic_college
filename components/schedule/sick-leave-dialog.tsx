'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import { formatDisplayDate, todayLocal } from '@/lib/dates'

type AffectedLesson = {
  scheduleSlotId: string
  date: string
  pairNumber: number
  groupName: string
  subjectName: string
}

export function SickLeaveDialog({ onClose }: { onClose: () => void }) {
  const [startDate, setStartDate] = useState(() => todayLocal())
  const [endDate, setEndDate] = useState(() => todayLocal())
  const [affectedLessons, setAffectedLessons] = useState<AffectedLesson[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const submit = async () => {
    setIsSaving(true)
    try {
      const result = await apiFetch<{ affectedLessons: AffectedLesson[] }>('/api/teachers/me/sick', {
        method: 'POST',
        body: { startDate, endDate },
      })
      setAffectedLessons(result.affectedLessons)
      setError(null)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog title="Сообщить о болезни" onClose={onClose}>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      {affectedLessons ? (
        <>
          <p className="mb-2">Учебная часть уведомлена. Пары, которым нужна замена: {affectedLessons.length}.</p>
          <div className="max-h-60 overflow-y-auto rounded border border-line">
            {affectedLessons.map((lesson) => (
              <p key={`${lesson.scheduleSlotId}:${lesson.date}`} className="border-b border-line px-3 py-1 last:border-b-0">
                <span className="tabular-nums text-muted">
                  {formatDisplayDate(lesson.date)}, {lesson.pairNumber} пара
                </span>{' '}
                {lesson.subjectName} · {lesson.groupName}
              </p>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Готово
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="С">
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </Field>
            <Field label="По">
              <Input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={onClose}>Отмена</Button>
            <Button variant="primary" disabled={isSaving} onClick={submit}>
              Отправить
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
