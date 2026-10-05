'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Select } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import { formatDisplayDate } from '@/lib/dates'
import type { Diary, GradeFeedItem, Page } from '@/lib/types'

export default function StudentGradesPage() {
  const diary = useApi<Diary>('/api/students/me')
  const [subjectId, setSubjectId] = useState('')
  const [grades, setGrades] = useState<GradeFeedItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPage = async (cursor: string | null, selectedSubjectId: string) => {
    const params = new URLSearchParams({ limit: '50' })
    if (cursor) {
      params.set('cursor', cursor)
    }
    if (selectedSubjectId) {
      params.set('subjectId', selectedSubjectId)
    }
    try {
      const page = await apiFetch<Page<GradeFeedItem>>(`/api/students/me/grades?${params.toString()}`)
      setGrades((current) => (cursor ? [...current, ...page.items] : page.items))
      setNextCursor(page.nextCursor)
      setError(null)
    } catch (reason) {
      setError(errorText(reason))
    }
  }

  useEffect(() => {
    loadPage(null, subjectId)
  }, [subjectId])

  return (
    <>
      <PageHeader title="Оценки">
        <Field label="Предмет" className="w-56">
          <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            <option value="">Все предметы</option>
            {(diary.data?.subjects ?? []).map((subject) => (
              <option key={subject.subjectId} value={subject.subjectId}>
                {subject.name}
              </option>
            ))}
          </Select>
        </Field>
      </PageHeader>

      {error ? <ErrorState message={error} /> : null}
      {grades.length === 0 && !error ? (
        <EmptyState>Оценок пока нет</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Дата</Th>
              <Th>Предмет</Th>
              <Th>Оценка</Th>
              <Th className="hidden md:table-cell">Преподаватель</Th>
              <Th>Комментарий</Th>
            </tr>
          </thead>
          <tbody>
            {grades.map((grade) => (
              <tr key={grade.id}>
                <Td className="tabular-nums text-muted">{formatDisplayDate(grade.date)}</Td>
                <Td>{grade.subject.name}</Td>
                <Td className={`font-medium tabular-nums ${grade.value <= 2 ? 'text-danger' : ''}`}>{grade.value}</Td>
                <Td className="hidden text-muted md:table-cell">{grade.teacher.fullName}</Td>
                <Td className="text-muted">{grade.comment ?? ''}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {nextCursor ? (
        <Button className="mt-3" onClick={() => loadPage(nextCursor, subjectId)}>
          Показать ещё
        </Button>
      ) : null}
    </>
  )
}
