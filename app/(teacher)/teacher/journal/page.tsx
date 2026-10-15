'use client'

import Link from 'next/link'
import { completionText, remainingText } from '@/components/hours/hours-format'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { useApi } from '@/lib/client/api'
import type { ProgramHoursReport, SubjectHours, TeacherSubjectGroups } from '@/lib/types'

function CompletionCell({ hours }: { hours: SubjectHours | undefined }) {
  if (!hours) {
    return <span className="text-muted">—</span>
  }
  return (
    <>
      <p className={hours.status === 'BEHIND' ? 'text-danger' : ''}>{completionText(hours)}</p>
      <p className="text-caption text-muted">{remainingText(hours)}</p>
    </>
  )
}

export default function TeacherJournalListPage() {
  const subjects = useApi<{ subjects: TeacherSubjectGroups[] }>('/api/teachers/me/subjects')
  const hours = useApi<ProgramHoursReport>('/api/teachers/me/hours')

  if (subjects.error) {
    return <ErrorState message={subjects.error} />
  }
  if (!subjects.data) {
    return <LoadingState />
  }
  const rows = subjects.data.subjects.flatMap((subject) => subject.groups.map((group) => ({ subject, group })))
  const hoursFor = (groupId: string, subjectId: string) =>
    hours.data?.subjects.find((row) => row.group.id === groupId && row.subject.id === subjectId)

  return (
    <>
      <PageHeader
        title="Журнал"
        caption={
          hours.data?.term
            ? `Предметы и группы по учебному плану. Окончание считается по расписанию ${hours.data.term.name} с учётом замен и доп. пар`
            : 'Предметы и группы по учебному плану'
        }
      />
      {rows.length === 0 ? (
        <EmptyState>Вам не назначены предметы</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Предмет</Th>
              <Th>Группа</Th>
              <Th>Семестр</Th>
              <Th className="text-right">Вычитано</Th>
              <Th>Окончание</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ subject, group }) => {
              const subjectHours = hoursFor(group.groupId, subject.subjectId)
              return (
                <tr key={`${subject.subjectId}:${group.groupId}:${group.semester}`}>
                  <Td className="font-medium">{subject.name}</Td>
                  <Td>{group.name}</Td>
                  <Td className="tabular-nums text-muted">{group.semester}</Td>
                  <Td className="whitespace-nowrap text-right tabular-nums">
                    {subjectHours ? `${subjectHours.conductedHoursToDate} из ${subjectHours.plannedHours} ч` : '—'}
                  </Td>
                  <Td>
                    <CompletionCell hours={subjectHours} />
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/teacher/journal/${group.groupId}/${subject.subjectId}`}
                      className="whitespace-nowrap text-accent hover:underline"
                    >
                      Открыть журнал
                    </Link>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </Table>
      )}
    </>
  )
}
