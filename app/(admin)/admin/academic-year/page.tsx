'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import { daysBetween, formatDisplayDate, parseDate, todayLocal } from '@/lib/dates'
import type { AcademicYear } from '@/lib/types'

type Range = { startDate: string; endDate: string }
type YearDraft = { startYear: number; first: Range; second: Range }

const defaultDates = { firstStart: '09-01', firstEnd: '12-28', secondStart: '01-12', secondEnd: '06-18' }

function draftFor(startYear: number, template: AcademicYear | null): YearDraft {
  const monthDay = (value: string | undefined, fallback: string) => (value ? value.slice(5) : fallback)
  return {
    startYear,
    first: {
      startDate: `${startYear}-${monthDay(template?.first?.startDate, defaultDates.firstStart)}`,
      endDate: `${startYear}-${monthDay(template?.first?.endDate, defaultDates.firstEnd)}`,
    },
    second: {
      startDate: `${startYear + 1}-${monthDay(template?.second?.startDate, defaultDates.secondStart)}`,
      endDate: `${startYear + 1}-${monthDay(template?.second?.endDate, defaultDates.secondEnd)}`,
    },
  }
}

function weeksOf(range: Range): number | null {
  if (!range.startDate || !range.endDate || range.startDate >= range.endDate) {
    return null
  }
  return Math.ceil((daysBetween(parseDate(range.startDate), parseDate(range.endDate)) + 1) / 7)
}

function breakOf(draft: YearDraft): number | null {
  if (!draft.first.endDate || !draft.second.startDate || draft.first.endDate >= draft.second.startDate) {
    return null
  }
  return daysBetween(parseDate(draft.first.endDate), parseDate(draft.second.startDate)) - 1
}

function currentAcademicYear(): number {
  const today = todayLocal()
  const year = Number(today.slice(0, 4))
  return today.slice(5) >= '08-01' ? year : year - 1
}

type YearEditorProps = { initial: YearDraft; isNew: boolean; onSaved: (years: AcademicYear[]) => void; onCancel?: () => void }

function YearEditor({ initial, isNew, onSaved, onCancel }: YearEditorProps) {
  const [draft, setDraft] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const holidayDays = breakOf(draft)

  const update = (half: 'first' | 'second', key: keyof Range, value: string) => {
    setSavedAt(null)
    setDraft((current) => ({ ...current, [half]: { ...current[half], [key]: value } }))
  }

  const save = async () => {
    setIsSaving(true)
    try {
      const { years } = await apiFetch<{ years: AcademicYear[] }>(`/api/admin/academic-years/${draft.startYear}`, {
        method: 'PUT',
        body: { first: draft.first, second: draft.second },
      })
      setError(null)
      setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))
      onSaved(years)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsSaving(false)
    }
  }

  const halves: Array<{ key: 'first' | 'second'; label: string }> = [
    { key: 'first', label: '1 семестр' },
    { key: 'second', label: '2 семестр' },
  ]

  return (
    <section className="mb-4 rounded border border-line">
      <header className="flex items-center justify-between border-b border-line bg-subtle px-3 py-2">
        <h2 className="font-medium">
          {draft.startYear}/{draft.startYear + 1} учебный год{isNew ? ' (новый)' : ''}
        </h2>
        {savedAt ? <span className="text-caption text-muted">Сохранено в {savedAt}</span> : null}
      </header>
      <div className="flex flex-col gap-3 p-3">
        {error ? <ErrorState message={error} /> : null}
        {halves.map(({ key, label }) => {
          const weeks = weeksOf(draft[key])
          return (
            <div key={key} className="grid items-end gap-3 md:grid-cols-[120px_180px_180px_1fr]">
              <p className="pb-2 font-medium">{label}</p>
              <Field label="Начало">
                <Input type="date" required value={draft[key].startDate} onChange={(event) => update(key, 'startDate', event.target.value)} />
              </Field>
              <Field label="Конец">
                <Input type="date" required value={draft[key].endDate} onChange={(event) => update(key, 'endDate', event.target.value)} />
              </Field>
              <p className="pb-2 text-caption text-muted">
                {weeks
                  ? `${formatDisplayDate(draft[key].startDate)} — ${formatDisplayDate(draft[key].endDate)}, недель: ${weeks}`
                  : 'Укажите даты'}
              </p>
            </div>
          )
        })}
        <p className="text-caption text-muted">
          {holidayDays !== null ? `Каникулы между семестрами: ${holidayDays} дн. ` : ''}
          Первая неделя семестра считается нечётной, от неё считается чётность недель в расписании. Пары, замены и
          вычитка часов пересчитываются по новым датам сразу после сохранения.
        </p>
        <div className="flex justify-end gap-2">
          {onCancel ? <Button onClick={onCancel}>Отмена</Button> : null}
          <Button variant="primary" disabled={isSaving} onClick={save}>
            Сохранить
          </Button>
        </div>
      </div>
    </section>
  )
}

export default function AcademicYearPage() {
  const years = useApi<{ years: AcademicYear[] }>('/api/admin/academic-years')
  const [newYear, setNewYear] = useState<YearDraft | null>(null)
  const list = years.data?.years ?? []
  const latest = list[list.length - 1] ?? null

  const addYear = () => {
    const startYear = latest ? latest.startYear + 1 : currentAcademicYear()
    setNewYear(draftFor(startYear, latest))
  }

  const handleSaved = () => {
    setNewYear(null)
    years.reload()
  }

  return (
    <>
      <PageHeader title="Учебный год" caption="Сроки семестров: по ним строится расписание, журнал и вычитка часов">
        <Button onClick={addYear} disabled={Boolean(newYear) || !years.data}>
          <Plus size={16} strokeWidth={1.5} />
          {latest ? 'Следующий учебный год' : 'Добавить учебный год'}
        </Button>
      </PageHeader>
      {years.error ? <ErrorState message={years.error} /> : null}
      {!years.data && years.isLoading ? <LoadingState /> : null}
      {newYear ? <YearEditor key={`new-${newYear.startYear}`} initial={newYear} isNew onSaved={handleSaved} onCancel={() => setNewYear(null)} /> : null}
      {[...list].reverse().map((year) => (
        <YearEditor
          key={`${year.startYear}:${year.first?.startDate}:${year.first?.endDate}:${year.second?.startDate}:${year.second?.endDate}`}
          initial={{
            startYear: year.startYear,
            first: year.first ?? draftFor(year.startYear, null).first,
            second: year.second ?? draftFor(year.startYear, null).second,
          }}
          isNew={false}
          onSaved={() => years.reload()}
        />
      ))}
      {years.data && list.length === 0 && !newYear ? (
        <p className="text-muted">Семестры ещё не заданы. Нажмите «Добавить учебный год».</p>
      ) : null}
    </>
  )
}
