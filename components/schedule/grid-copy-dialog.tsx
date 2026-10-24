'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import type { GridCopyResult } from '@/lib/types'

type GridCopyDialogProps = {
  groupId: string
  groupName: string
  fromSemester: number
  semesterOptions: Array<{ value: number; label: string }>
  onClose: () => void
  onCopied: (toSemester: number) => void
}

export function GridCopyDialog({ groupId, groupName, fromSemester, semesterOptions, onClose, onCopied }: GridCopyDialogProps) {
  const targets = semesterOptions.filter((option) => option.value !== fromSemester)
  const [toSemester, setToSemester] = useState(
    targets.find((option) => option.value === fromSemester + 1)?.value ?? targets[0]?.value ?? fromSemester,
  )
  const [includeCurriculum, setIncludeCurriculum] = useState(true)
  const [result, setResult] = useState<GridCopyResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const copy = async () => {
    setIsSaving(true)
    try {
      const response = await apiFetch<GridCopyResult>('/api/schedule/slots/copy', {
        method: 'POST',
        body: { groupId, fromSemester, toSemester, includeCurriculum },
      })
      setResult(response)
      setError(null)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog title={`Сетка ${groupName} на другой семестр`} onClose={onClose}>
      <div className="flex flex-col gap-3">
        {error ? <ErrorState message={error} /> : null}
        <p className="text-muted">
          Пары {fromSemester} семестра скопируются в выбранный семестр. Потом сетку можно поправить: убрать
          закончившиеся предметы и добавить новые.
        </p>
        <Field label="В какой семестр">
          <Select value={toSemester} onChange={(event) => setToSemester(Number(event.target.value))}>
            {targets.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-accent"
            checked={includeCurriculum}
            onChange={(event) => setIncludeCurriculum(event.target.checked)}
          />
          Скопировать и учебный план: предметы и преподавателей
        </label>
        <p className="text-caption text-muted">
          Без учебного плана скопируются только пары тех предметов, которые уже есть в плане выбранного семестра.
          Пары, которые пересекаются с занятиями других групп, пропускаются.
        </p>

        {result ? (
          <div className="rounded border border-line p-2">
            <p>
              Скопировано пар: {result.created}
              {includeCurriculum ? `, предметов в учебный план: ${result.curriculaCreated}` : ''}
            </p>
            {result.skipped.length > 0 ? (
              <>
                <p className="mt-1 text-caption text-danger">Пропущено: {result.skipped.length}</p>
                <ul className="mt-1 max-h-40 overflow-y-auto text-caption text-muted">
                  {result.skipped.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          {result ? (
            <Button variant="primary" onClick={() => onCopied(toSemester)}>
              Открыть {toSemester} семестр
            </Button>
          ) : (
            <>
              <Button onClick={onClose}>Отмена</Button>
              <Button variant="primary" disabled={isSaving || targets.length === 0} onClick={copy}>
                Скопировать
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  )
}
