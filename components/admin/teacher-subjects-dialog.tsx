'use client'

import { useState } from 'react'
import { DirectoryRow, text, useDirectory } from '@/components/admin/use-directory'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'

type TeacherSubjectsDialogProps = { teacher: DirectoryRow; onClose: () => void; onSaved: () => void }

export function TeacherSubjectsDialog({ teacher, onClose, onSaved }: TeacherSubjectsDialogProps) {
  const subjects = useDirectory('subjects')
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    Array.isArray(teacher.subjectIds) ? (teacher.subjectIds as string[]) : [],
  )
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const toggle = (subjectId: string) =>
    setSelectedIds((current) =>
      current.includes(subjectId) ? current.filter((id) => id !== subjectId) : [...current, subjectId],
    )

  const save = async () => {
    setIsSaving(true)
    try {
      await apiFetch(`/api/admin/teachers/${teacher.id}/subjects`, { method: 'POST', body: { subjectIds: selectedIds } })
      onSaved()
    } catch (reason) {
      setError(errorText(reason))
      setIsSaving(false)
    }
  }

  return (
    <Dialog title={`Предметы: ${text(teacher, 'fullName')}`} onClose={onClose}>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      <div className="max-h-[50vh] overflow-y-auto rounded border border-line">
        {subjects.map((subject) => (
          <label
            key={subject.id}
            className="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-1.5 transition-colors last:border-b-0 hover:bg-subtle"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(subject.id)}
              onChange={() => toggle(subject.id)}
              className="accent-accent"
            />
            <span className="flex-1">{text(subject, 'name')}</span>
            <span className="text-caption text-muted">{text(subject, 'code')}</span>
          </label>
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
