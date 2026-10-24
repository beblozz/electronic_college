'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import type { ParallelGroup, PlanCopyResult, PlanItemKind } from '@/lib/types'

type PlanCopyPanelProps = {
  groupId: string
  subjectId: string
  admissionThreshold: number | null
  autoCreditThreshold: number | null
  items: Array<{ kind: PlanItemKind; title: string }>
}

function resultText(result: PlanCopyResult): string {
  const dates = result.datedCount > 0 ? `, с датами: ${result.datedCount}` : ''
  return `${result.groupName}: ${result.itemCount} работ${dates}`
}

export function PlanCopyPanel({ groupId, subjectId, admissionThreshold, autoCreditThreshold, items }: PlanCopyPanelProps) {
  const parallel = useApi<{ groups: ParallelGroup[] }>(
    `/api/journal/plan/parallel?groupId=${groupId}&subjectId=${subjectId}`,
  )
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [withDates, setWithDates] = useState(true)
  const [results, setResults] = useState<PlanCopyResult[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCopying, setIsCopying] = useState(false)
  const groups = parallel.data?.groups ?? []
  const replaced = groups.filter((group) => selectedIds.includes(group.id) && group.planItemCount > 0)

  const toggle = (id: string) =>
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  const copy = async () => {
    setIsCopying(true)
    try {
      const response = await apiFetch<{ results: PlanCopyResult[] }>('/api/journal/plan/copy', {
        method: 'POST',
        body: {
          subjectId,
          targetGroupIds: selectedIds,
          withDates,
          admissionThreshold,
          autoCreditThreshold,
          items: items.map((item) => ({ kind: item.kind, title: item.title })),
        },
      })
      setResults(response.results)
      setSelectedIds([])
      setError(null)
      parallel.reload()
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <div className="rounded border border-line p-3">
      <p className="mb-2 font-medium">Скопировать в параллельную группу</p>
      {error ? (
        <div className="mb-2">
          <ErrorState message={error} />
        </div>
      ) : null}
      {parallel.error ? <ErrorState message={parallel.error} /> : null}
      {!parallel.data && parallel.isLoading ? <LoadingState /> : null}
      {parallel.data && groups.length === 0 ? (
        <p className="text-muted">Нет групп того же курса, где вы ведёте этот предмет.</p>
      ) : null}
      {groups.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {groups.map((group) => (
            <label key={group.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                className="accent-accent"
                checked={selectedIds.includes(group.id)}
                onChange={() => toggle(group.id)}
              />
              <span>{group.name}</span>
              <span className="text-caption text-muted">
                {group.planItemCount > 0 ? `КТП уже есть: ${group.planItemCount} работ` : 'КТП нет'}
              </span>
            </label>
          ))}
          <label className="mt-1 flex items-center gap-2 text-caption text-muted">
            <input
              type="checkbox"
              className="accent-accent"
              checked={withDates}
              onChange={(event) => setWithDates(event.target.checked)}
            />
            Расставить даты по расписанию каждой группы
          </label>
          {replaced.length > 0 ? (
            <p className="text-caption text-danger">
              КТП групп {replaced.map((group) => group.name).join(', ')} будет заменён. Уже выставленные оценки
              останутся, но отвяжутся от старых работ.
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <span className="text-caption text-muted">Копируется текущий список работ из этого окна, даже несохранённый.</span>
            <Button size="small" disabled={isCopying || selectedIds.length === 0 || items.length === 0} onClick={copy}>
              Скопировать
            </Button>
          </div>
        </div>
      ) : null}
      {results ? (
        <p className="mt-2 text-caption text-muted">Скопировано. {results.map(resultText).join('; ')}</p>
      ) : null}
    </div>
  )
}
