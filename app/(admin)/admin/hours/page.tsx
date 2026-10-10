'use client'

import { useEffect, useState } from 'react'
import { text, useDirectory } from '@/components/admin/use-directory'
import { HoursLegend, SubjectHoursTable, TeacherHoursTable } from '@/components/hours/hours-tables'
import { Field, Select } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { useApi } from '@/lib/client/api'
import { formatDisplayDate, todayLocal } from '@/lib/dates'
import type { ProgramHoursReport } from '@/lib/types'

type Mode = 'subjects' | 'teachers'

const modeLabels: Record<Mode, string> = { subjects: 'По предметам', teachers: 'По преподавателям' }

export default function AdminHoursPage() {
  const terms = useDirectory('terms')
  const groups = useDirectory('groups')
  const [termId, setTermId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [mode, setMode] = useState<Mode>('subjects')
  const [isProblemsOnly, setIsProblemsOnly] = useState(true)

  useEffect(() => {
    if (!termId && terms.length > 0) {
      const today = todayLocal()
      const current = terms.find((term) => text(term, 'startDate') <= today && text(term, 'endDate') >= today)
      setTermId((current ?? terms[0]).id)
    }
  }, [terms, termId])

  const params = new URLSearchParams()
  if (termId) {
    params.set('termId', termId)
  }
  if (groupId) {
    params.set('groupId', groupId)
  }
  const report = useApi<ProgramHoursReport>(termId ? `/api/admin/hours?${params.toString()}` : null)
  const subjectRows = (report.data?.subjects ?? []).filter(
    (row) => !isProblemsOnly || row.status !== 'ON_TRACK' || row.balancePairsToDate !== 0,
  )

  return (
    <>
      <PageHeader
        title="Вычитка часов"
        caption={
          report.data?.term
            ? `${report.data.term.name}: ${formatDisplayDate(report.data.term.startDate)} — ${formatDisplayDate(report.data.term.endDate)}`
            : 'Как замены и пропуски меняют выполнение программы'
        }
      >
        <Field label="Семестр" className="w-60">
          <Select value={termId} onChange={(event) => setTermId(event.target.value)}>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                {text(term, 'name')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Группа" className="w-44">
          <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">Все группы</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {text(group, 'name')}
              </option>
            ))}
          </Select>
        </Field>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line">
        <div className="flex gap-1">
          {(Object.keys(modeLabels) as Mode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`-mb-px border-b-2 px-2.5 py-1.5 transition-colors ${
                item === mode ? 'border-accent font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {modeLabels[item]}
            </button>
          ))}
        </div>
        {mode === 'subjects' ? (
          <label className="flex items-center gap-2 pb-1 text-caption text-muted">
            <input
              type="checkbox"
              className="accent-accent"
              checked={isProblemsOnly}
              onChange={(event) => setIsProblemsOnly(event.target.checked)}
            />
            Только предметы с расхождением
          </label>
        ) : null}
      </div>

      {report.error ? <ErrorState message={report.error} /> : null}
      {!report.data && report.isLoading ? <LoadingState /> : null}
      {report.data && mode === 'subjects' ? (
        <SubjectHoursTable rows={subjectRows} termEnd={report.data.term?.endDate ?? null} showGroup={!groupId} />
      ) : null}
      {report.data && mode === 'teachers' ? <TeacherHoursTable rows={report.data.teachers} /> : null}
      <HoursLegend />
    </>
  )
}
