'use client'

import { Trash2 } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { roleLabels } from '@/components/layout/navigation'
import { useSocketEvent } from '@/components/layout/realtime-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { Section } from '@/components/ui/section'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import { useCurrentUser } from '@/lib/client/use-current-user'
import { formatDateTime } from '@/lib/dates'
import type { AnnouncementDto, Page, Role, TeacherSubjectGroups } from '@/lib/types'

type GroupOption = { id: string; name: string }

function useTargetGroups(role: Role | undefined): GroupOption[] {
  const adminGroups = useApi<Page<GroupOption>>(role === 'ADMIN' ? '/api/admin/groups?limit=200' : null)
  const teacherSubjects = useApi<{ subjects: TeacherSubjectGroups[] }>(
    role === 'TEACHER' ? '/api/teachers/me/subjects' : null,
  )
  if (role === 'ADMIN') {
    return adminGroups.data?.items ?? []
  }
  const groupsById = new Map<string, GroupOption>()
  for (const subject of teacherSubjects.data?.subjects ?? []) {
    for (const group of subject.groups) {
      groupsById.set(group.groupId, { id: group.groupId, name: group.name })
    }
  }
  return [...groupsById.values()]
}

export default function AnnouncementsPage() {
  const user = useCurrentUser()
  const announcements = useApi<Page<AnnouncementDto>>('/api/announcements?limit=100')
  const groups = useTargetGroups(user?.role)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [targetGroupId, setTargetGroupId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  useSocketEvent('announcement:created', announcements.reload)

  const canPublish = user?.role === 'ADMIN' || user?.role === 'TEACHER'

  const publish = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await apiFetch('/api/announcements', {
        method: 'POST',
        body: { title, body, targetRole: targetRole || null, targetGroupId: targetGroupId || null },
      })
      setTitle('')
      setBody('')
      setError(null)
      announcements.reload()
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (announcementId: string) => {
    try {
      await apiFetch(`/api/announcements/${announcementId}`, { method: 'DELETE' })
      announcements.reload()
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  return (
    <>
      <PageHeader title="Объявления" />
      {error ?? announcements.error ? (
        <div className="mb-3">
          <ErrorState message={error ?? announcements.error ?? ''} />
        </div>
      ) : null}

      <div className={`grid gap-6 ${canPublish ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
        <div>
          {!announcements.data ? <LoadingState /> : null}
          {announcements.data?.items.length === 0 ? <EmptyState>Объявлений нет</EmptyState> : null}
          {announcements.data && announcements.data.items.length > 0 ? (
            <div className="rounded border border-line">
              {announcements.data.items.map((announcement) => (
                <article key={announcement.id} className="border-b border-line px-3 py-2.5 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-medium">{announcement.title}</h2>
                    {user && (user.role === 'ADMIN' || user.id === announcement.author.id) ? (
                      <button
                        type="button"
                        aria-label="Удалить объявление"
                        onClick={() => remove(announcement.id)}
                        className="rounded p-1 text-muted transition-colors hover:bg-subtle hover:text-danger"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap">{announcement.body}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-muted">
                    <span>
                      {announcement.author.lastName} {announcement.author.firstName}
                    </span>
                    <span className="tabular-nums">{formatDateTime(announcement.createdAt)}</span>
                    {announcement.targetGroupName ? <Badge>{announcement.targetGroupName}</Badge> : null}
                    {announcement.targetRole ? <Badge>{roleLabels[announcement.targetRole]}</Badge> : null}
                  </p>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        {canPublish ? (
          <Section title="Новое объявление">
            <form onSubmit={publish} className="flex flex-col gap-3 rounded border border-line p-3">
              <Field label="Заголовок">
                <Input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              <Field label="Текст">
                <Textarea required rows={5} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} />
              </Field>
              <Field label="Группа">
                <Select
                  value={targetGroupId}
                  required={user?.role === 'TEACHER'}
                  onChange={(event) => setTargetGroupId(event.target.value)}
                >
                  <option value="">{user?.role === 'ADMIN' ? 'Все группы' : 'Выберите'}</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {user?.role === 'ADMIN' ? (
                <Field label="Кому">
                  <Select value={targetRole} onChange={(event) => setTargetRole(event.target.value)}>
                    <option value="">Всем</option>
                    <option value="STUDENT">Студентам</option>
                    <option value="TEACHER">Преподавателям</option>
                  </Select>
                </Field>
              ) : null}
              <Button type="submit" variant="primary" disabled={isSaving}>
                Опубликовать
              </Button>
            </form>
          </Section>
        ) : null}
      </div>
    </>
  )
}
