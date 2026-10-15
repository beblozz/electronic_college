'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import type { PlanCopyResult, PlanItemKind, PlanTransferTarget } from '@/lib/types'

type PlanTransferPanelProps = {
  groupId: string
  subjectId: string
  admissionThreshold: number | null
  autoCreditThreshold: number | null
  items: Array<{ kind: PlanItemKind; title: string }>
}

function targetKey(target: Pick<PlanTransferTarget, 'groupId' | 'subjectId'>): string {
  return `${target.groupId}:${target.subjectId}`
}

function targetLabel(target: PlanTransferTarget): string {
  const plan = target.planItemCount > 0 ? `КТП есть: ${target.planItemCount}` : 'КТП нет'
  return `${target.groupName} · ${target.subjectName} · ${target.courseYear} курс · ${plan}`
}

function resultText(result: PlanCopyResult): string {
  const dates = result.datedCount > 0 ? `, даты по расписанию: ${result.datedCount}` : ', без дат'
  return `КТП перенесён: ${result.groupName}, «${result.subjectName}», пунктов ${result.itemCount}${dates}`
}

export function PlanTransferPanel({
  groupId,
  subjectId,
  admissionThreshold,
  autoCreditThreshold,
  items,
}: PlanTransferPanelProps) {
  const targets = useApi<{ targets: PlanTransferTarget[] }>(
    `/api/journal/plan/targets?groupId=${groupId}&subjectId=${subjectId}`,
  )
  const [selectedKey, setSelectedKey] = useState('')
  const [withDates, setWithDates] = useState(true)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const list = targets.data?.targets ?? []
  const sameSubject = list.filter((target) => target.isSameSubject)
  const otherSubjects = list.filter((target) => !target.isSameSubject)
  const selected = list.find((target) => targetKey(target) === selectedKey) ?? null

  const transfer = async () => {
    if (!selected) {
      return
    }
    setIsSaving(true)
    try {
      const response = await apiFetch<{ results: PlanCopyResult[] }>('/api/journal/plan/copy', {
        method: 'POST',
        body: {
          targets: [{ groupId: selected.groupId, subjectId: selected.subjectId }],
          withDates,
          admissionThreshold,
          autoCreditThreshold,
          items: items.map((item) => ({ kind: item.kind, title: item.title })),
        },
      })
      setResult(response.results.map(resultText).join('; '))
      setError(null)
      targets.reload()
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded border border-line p-3">
      <p className="mb-2 font-medium">Перенос КТП</p>
      {error ? (
        <div className="mb-2">
          <ErrorState message={error} />
        </div>
      ) : null}
      {targets.error ? <ErrorState message={targets.error} /> : null}
      {!targets.data && targets.isLoading ? <LoadingState /> : null}
      {targets.data && list.length === 0 ? (
        <p className="text-muted">Других групп и предметов в вашем журнале и расписании нет.</p>
      ) : null}
      {list.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Field label="Куда перенести">
            <Select
              value={selectedKey}
              onChange={(event) => {
                setSelectedKey(event.target.value)
                setResult(null)
              }}
            >
              <option value="">Выберите группу и предмет</option>
              {sameSubject.length > 0 ? (
                <optgroup label="Этот же предмет">
                  {sameSubject.map((target) => (
                    <option key={targetKey(target)} value={targetKey(target)}>
                      {targetLabel(target)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {otherSubjects.length > 0 ? (
                <optgroup label="Другие предметы">
                  {otherSubjects.map((target) => (
                    <option key={targetKey(target)} value={targetKey(target)}>
                      {targetLabel(target)}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-caption text-muted">
            <input
              type="checkbox"
              className="accent-accent"
              checked={withDates}
              onChange={(event) => setWithDates(event.target.checked)}
            />
            Расставить даты по расписанию выбранной группы
          </label>
          {selected && selected.planItemCount > 0 ? (
            <p className="text-caption text-danger">
              У {selected.groupName} по предмету «{selected.subjectName}» уже есть КТП, он будет заменён. Выставленные
              оценки останутся, но отвяжутся от старых работ.
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-muted">Переносится текущий список работ из этого окна, даже несохранённый.</span>
            <Button variant="primary" size="small" disabled={isSaving || !selected || items.length === 0} onClick={transfer}>
              Перенести КТП
            </Button>
          </div>
        </div>
      ) : null}
      {result ? <p className="mt-2 text-caption text-muted">{result}</p> : null}
    </div>
  )
}
