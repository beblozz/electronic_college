'use client'

import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { useApi } from '@/lib/client/api'
import type { TeacherSubjectGroups } from '@/lib/types'

export default function TeacherJournalListPage() {
  const subjects = useApi<{ subjects: TeacherSubjectGroups[] }>('/api/teachers/me/subjects')

  if (subjects.error) {
    return <ErrorState message={subjects.error} />
  }
  if (!subjects.data) {
    return <LoadingState />
  }
  const rows = subjects.data.subjects.flatMap((subject) => subject.groups.map((group) => ({ subject, group })))

  return (
    <>
      <PageHeader title="Журнал" caption="Предметы и группы по учебному плану" />
      {rows.length === 0 ? (
        <EmptyState>Вам не назначены предметы</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Предмет</Th>
              <Th>Группа</Th>
              <Th>Семестр</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ subject, group }) => (
              <tr key={`${subject.subjectId}:${group.groupId}:${group.semester}`}>
                <Td className="font-medium">{subject.name}</Td>
                <Td>{group.name}</Td>
                <Td className="tabular-nums text-muted">{group.semester}</Td>
                <Td className="text-right">
                  <Link
                    href={`/teacher/journal/${group.groupId}/${subject.subjectId}`}
                    className="text-accent hover:underline"
                  >
                    Открыть журнал
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}
