'use client'

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { planItemKindLabels } from '@/components/journal/journal-labels'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import type { PlanItemKind, StudyPlanDto } from '@/lib/types'

type DraftItem = { key: string; id?: string; kind: PlanItemKind; title: string; plannedDate: string }

type PlanDialogProps = {
  groupId: string
  subjectId: string
  plan: StudyPlanDto
  onClose: () => void
  onSaved: () => void
}

const defaultLectureCount = 3
const defaultPracticalCount = 4

let draftCounter = 0

function newDraft(kind: PlanItemKind, title: string): DraftItem {
  draftCounter += 1
  return { key: `new-${draftCounter}`, kind, title, plannedDate: '' }
}

function numberedTitle(kind: PlanItemKind, items: DraftItem[]): string {
  const sameKindCount = items.filter((item) => item.kind === kind).length + 1
  return kind === 'LECTURE' ? `Лекция ${sameKindCount}` : `Практическая работа ${sameKindCount}`
}

function spreadDate(dates: string[], index: number, count: number): string | null {
  if (count > dates.length) {
    return dates[index] ?? null
  }
  return dates[Math.round(((index + 1) * dates.length) / count) - 1] ?? null
}

export function PlanDialog({ groupId, subjectId, plan, onClose, onSaved }: PlanDialogProps) {
  const [items, setItems] = useState<DraftItem[]>(() =>
    plan.items.map((item) => ({
      key: item.id,
      id: item.id,
      kind: item.kind,
      title: item.title,
      plannedDate: item.plannedDate ?? '',
    })),
  )
  const [admission, setAdmission] = useState(plan.customAdmissionThreshold?.toString() ?? '')
  const [autoCredit, setAutoCredit] = useState(plan.customAutoCreditThreshold?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isFillingDates, setIsFillingDates] = useState(false)

  const total = items.length
  const defaultAdmission = Math.floor(total / 2)

  const update = (key: string, changes: Partial<DraftItem>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...changes } : item)))

  const move = (index: number, offset: number) =>
    setItems((current) => {
      const target = index + offset
      if (target < 0 || target >= current.length) {
        return current
      }
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })

  const add = (kind: PlanItemKind) => setItems((current) => [...current, newDraft(kind, numberedTitle(kind, current))])

  const fillTypical = () => {
    const generated: DraftItem[] = []
    for (let index = 1; index <= defaultLectureCount; index += 1) {
      generated.push(newDraft('LECTURE', `Лекция ${index}`))
    }
    for (let index = 1; index <= defaultPracticalCount; index += 1) {
      generated.push(newDraft('PRACTICAL', `Практическая работа ${index}`))
    }
    setItems(generated)
  }

  const fillDates = async () => {
    setIsFillingDates(true)
    try {
      const params = new URLSearchParams({ groupId, subjectId })
      const { dates } = await apiFetch<{ dates: string[] }>(`/api/journal/plan/dates?${params.toString()}`)
      if (dates.length === 0) {
        setNotice('В текущем семестре нет пар по этому предмету')
        return
      }
      setItems((current) =>
        current.map((item, index) => {
          const date = spreadDate(dates, index, current.length)
          return date ? { ...item, plannedDate: date } : item
        }),
      )
      setNotice(
        items.length > dates.length
          ? `В семестре ${dates.length} пар, работ больше: последним ${items.length - dates.length} дата не назначена`
          : `Работы распределены равномерно по ${dates.length} парам семестра. Даты можно поправить вручную.`,
      )
      setError(null)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsFillingDates(false)
    }
  }

  const save = async () => {
    setIsSaving(true)
    try {
      await apiFetch('/api/journal/plan', {
        method: 'PUT',
        body: {
          groupId,
          subjectId,
          admissionThreshold: admission === '' ? null : Number(admission),
          autoCreditThreshold: autoCredit === '' ? null : Number(autoCredit),
          items: items.map((item) => ({
            id: item.id,
            kind: item.kind,
            title: item.title,
            plannedDate: item.plannedDate || null,
          })),
        },
      })
      onSaved()
    } catch (failure) {
      setError(errorText(failure))
      setIsSaving(false)
    }
  }

  return (
    <Dialog title={`КТП на ${plan.semester} семестр`} width="wide" onClose={onClose}>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      <p className="mb-3 text-caption text-muted">
        Работа считается сданной, если за неё стоит оценка 3 и выше. Оценка, выставленная в дату работы, привязывается к ней
        автоматически, тип оценки подставляется из КТП. Если дата прошла, а оценки нет, студент попадает в отстающие.
      </p>

      <div className="max-h-[45vh] overflow-y-auto rounded border border-line">
        {items.length === 0 ? (
          <p className="px-3 py-4 text-center text-muted">Работ пока нет</p>
        ) : null}
        {items.map((item, index) => (
          <div key={item.key} className="flex flex-wrap items-center gap-2 border-b border-line px-2 py-1.5 last:border-b-0">
            <span className="w-6 text-right tabular-nums text-muted">{index + 1}</span>
            <Select
              className="!w-52"
              value={item.kind}
              onChange={(event) => update(item.key, { kind: event.target.value as PlanItemKind })}
            >
              {(Object.keys(planItemKindLabels) as PlanItemKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {planItemKindLabels[kind]}
                </option>
              ))}
            </Select>
            <Input
              className="!w-auto min-w-40 flex-1"
              value={item.title}
              maxLength={200}
              onChange={(event) => update(item.key, { title: event.target.value })}
            />
            <Input
              type="date"
              className="!w-40"
              title="Срок сдачи"
              value={item.plannedDate}
              onChange={(event) => update(item.key, { plannedDate: event.target.value })}
            />
            <Button size="small" variant="ghost" aria-label="Выше" onClick={() => move(index, -1)}>
              <ArrowUp size={16} strokeWidth={1.5} />
            </Button>
            <Button size="small" variant="ghost" aria-label="Ниже" onClick={() => move(index, 1)}>
              <ArrowDown size={16} strokeWidth={1.5} />
            </Button>
            <Button
              size="small"
              variant="ghost"
              aria-label="Удалить"
              onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))}
            >
              <Trash2 size={16} strokeWidth={1.5} />
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="small" onClick={() => add('LECTURE')}>
          Добавить лекцию
        </Button>
        <Button size="small" onClick={() => add('PRACTICAL')}>
          Добавить практическую
        </Button>
        <Button size="small" variant="ghost" onClick={fillTypical}>
          Заполнить: 3 лекции и 4 практические
        </Button>
        <Button size="small" variant="ghost" disabled={isFillingDates || items.length === 0} onClick={fillDates}>
          Даты по расписанию
        </Button>
      </div>
      {notice ? <p className="mt-2 text-caption text-muted">{notice}</p> : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label={`Работ для допуска (по умолчанию половина — ${defaultAdmission})`}>
          <Input
            type="number"
            min={0}
            max={total}
            placeholder={String(defaultAdmission)}
            value={admission}
            onChange={(event) => setAdmission(event.target.value)}
          />
        </Field>
        <Field label={`Работ для автомата (по умолчанию все — ${total})`}>
          <Input
            type="number"
            min={0}
            max={total}
            placeholder={String(total)}
            value={autoCredit}
            onChange={(event) => setAutoCredit(event.target.value)}
          />
        </Field>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="primary" disabled={isSaving || items.some((item) => !item.title.trim())} onClick={save}>
          Сохранить КТП
        </Button>
      </div>
    </Dialog>
  )
}
