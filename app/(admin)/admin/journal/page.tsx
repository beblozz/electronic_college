'use client'

import { useEffect, useState } from 'react'
import { text, useDirectory } from '@/components/admin/use-directory'
import { JournalView } from '@/components/journal/journal-view'
import { Field, Select } from '@/components/ui/field'
import { EmptyState } from '@/components/ui/states'

export default function AdminJournalPage() {
  const groups = useDirectory('groups')
  const [groupId, setGroupId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const curricula = useDirectory(groupId ? 'curricula' : null, `&groupId=${groupId}`)

  useEffect(() => {
    if (!groupId && groups.length > 0) {
      setGroupId(groups[0].id)
    }
  }, [groups, groupId])

  useEffect(() => {
    const hasSubject = curricula.some((curriculum) => text(curriculum, 'subjectId') === subjectId)
    if (!hasSubject) {
      setSubjectId(text(curricula[0], 'subjectId'))
    }
  }, [curricula, subjectId])

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-3">
        <Field label="Группа" className="w-44">
          <Select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {text(group, 'name')}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Предмет" className="w-64">
          <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {curricula.map((curriculum) => (
              <option key={curriculum.id} value={text(curriculum, 'subjectId')}>
                {text(curriculum, 'subjectName')} · {text(curriculum, 'semester')} сем.
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {groupId && subjectId ? (
        <JournalView key={`${groupId}:${subjectId}`} groupId={groupId} subjectId={subjectId} />
      ) : (
        <EmptyState>Выберите группу и предмет из учебного плана</EmptyState>
      )}
    </>
  )
}
