'use client'

import { useState } from 'react'
import { DismissDialog } from '@/components/staff/dismiss-dialog'
import { dismissalReasonLabels, staffStatusLabels } from '@/components/staff/staff-labels'
import { StaffProfileDialog } from '@/components/staff/staff-profile-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import { formatDisplayDate } from '@/lib/dates'
import { formatExperience } from '@/lib/staff/experience'
import type { StaffMember } from '@/lib/types'

type Tab = 'active' | 'archive'

const statusTones = { ACTIVE: 'neutral', SICK: 'warning', VACATION: 'warning', FIRED: 'neutral' } as const

function matches(member: StaffMember, search: string): boolean {
  const query = search.trim().toLowerCase()
  return !query || `${member.fullName} ${member.email} ${member.departmentName}`.toLowerCase().includes(query)
}

function averageYears(members: StaffMember[]): string {
  const known = members.flatMap((member) => (member.experience ? [member.experience.years + member.experience.months / 12] : []))
  if (known.length === 0) {
    return '—'
  }
  return (known.reduce((sum, value) => sum + value, 0) / known.length).toFixed(1)
}

function EducationCell({ member }: { member: StaffMember }) {
  return (
    <>
      <p className={member.hasHigherEducation ? '' : 'text-muted'}>{member.hasHigherEducation ? 'Высшее' : 'Нет высшего'}</p>
      {member.education ? <p className="text-caption text-muted">{member.education}</p> : null}
    </>
  )
}

export default function AdminStaffPage() {
  const [tab, setTab] = useState<Tab>('active')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<StaffMember | null>(null)
  const [dismissing, setDismissing] = useState<StaffMember | null>(null)
  const [error, setError] = useState<string | null>(null)
  const active = useApi<{ staff: StaffMember[] }>('/api/admin/staff?archive=0')
  const archive = useApi<{ staff: StaffMember[] }>('/api/admin/staff?archive=1')
  const current = tab === 'active' ? active : archive
  const rows = (current.data?.staff ?? []).filter((member) => matches(member, search))
  const activeStaff = active.data?.staff ?? []
  const higherCount = activeStaff.filter((member) => member.hasHigherEducation).length

  const reload = () => {
    active.reload()
    archive.reload()
  }

  const restore = async (member: StaffMember) => {
    try {
      await apiFetch(`/api/admin/staff/${member.id}/restore`, { method: 'POST' })
      setError(null)
      reload()
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'active', label: `Работают${active.data ? ` (${active.data.staff.length})` : ''}` },
    { key: 'archive', label: `Архив${archive.data ? ` (${archive.data.staff.length})` : ''}` },
  ]

  return (
    <>
      <PageHeader
        title="Преподаватели"
        caption={
          active.data
            ? `Работают: ${activeStaff.length}, с высшим образованием: ${higherCount}${
                activeStaff.length > 0 ? ` (${Math.round((higherCount / activeStaff.length) * 100)}%)` : ''
              }, средний педагогический стаж: ${averageYears(activeStaff)} лет`
            : 'Стаж, образование и архив уволенных'
        }
      >
        <Field label="Поиск" className="w-64">
          <Input value={search} placeholder="Фамилия, почта, кафедра" onChange={(event) => setSearch(event.target.value)} />
        </Field>
      </PageHeader>

      <div className="mb-3 flex gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`-mb-px border-b-2 px-2.5 py-1.5 transition-colors ${
              item.key === tab ? 'border-accent font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      {current.error ? <ErrorState message={current.error} /> : null}
      {!current.data && current.isLoading ? <LoadingState /> : null}
      {current.data && rows.length === 0 ? (
        <EmptyState>{tab === 'active' ? 'Преподавателей не найдено' : 'В архиве никого нет'}</EmptyState>
      ) : null}

      {current.data && rows.length > 0 && tab === 'active' ? (
        <Table>
          <thead>
            <tr>
              <Th>Преподаватель</Th>
              <Th>Кафедра</Th>
              <Th>Педагогический стаж</Th>
              <Th>В колледже</Th>
              <Th>Образование</Th>
              <Th>Статус</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => (
              <tr key={member.id}>
                <Td>
                  <p className="font-medium">{member.fullName}</p>
                  <p className="text-caption text-muted">{member.email}</p>
                </Td>
                <Td>{member.departmentName}</Td>
                <Td className="whitespace-nowrap">{formatExperience(member.experience)}</Td>
                <Td className="whitespace-nowrap">
                  {formatExperience(member.collegeExperience)}
                  {member.hiredAt ? <p className="text-caption text-muted">с {formatDisplayDate(member.hiredAt)}</p> : null}
                </Td>
                <Td>
                  <EducationCell member={member} />
                </Td>
                <Td>
                  <Badge tone={statusTones[member.status]}>{staffStatusLabels[member.status]}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <Button size="small" variant="ghost" onClick={() => setEditing(member)}>
                    Изменить
                  </Button>
                  <Button size="small" variant="ghost" onClick={() => setDismissing(member)}>
                    В архив
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}

      {current.data && rows.length > 0 && tab === 'archive' ? (
        <Table>
          <thead>
            <tr>
              <Th>Преподаватель</Th>
              <Th>Кафедра</Th>
              <Th>Уволен</Th>
              <Th>Причина</Th>
              <Th>Стаж на момент увольнения</Th>
              <Th>Образование</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((member) => (
              <tr key={member.id}>
                <Td>
                  <p className="font-medium">{member.fullName}</p>
                  <p className="text-caption text-muted">{member.email}</p>
                </Td>
                <Td>{member.departmentName}</Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {member.dismissedAt ? formatDisplayDate(member.dismissedAt) : '—'}
                </Td>
                <Td>
                  <p>{member.dismissalReason ? dismissalReasonLabels[member.dismissalReason] : 'Причина не указана'}</p>
                  {member.dismissalNote ? <p className="text-caption text-muted">{member.dismissalNote}</p> : null}
                </Td>
                <Td className="whitespace-nowrap">{formatExperience(member.experience)}</Td>
                <Td>
                  <EducationCell member={member} />
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <Button size="small" variant="ghost" onClick={() => setEditing(member)}>
                    Изменить
                  </Button>
                  <Button size="small" onClick={() => restore(member)}>
                    Восстановить
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}

      {editing ? (
        <StaffProfileDialog
          member={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            reload()
          }}
        />
      ) : null}
      {dismissing ? (
        <DismissDialog
          member={dismissing}
          onClose={() => setDismissing(null)}
          onSaved={() => {
            setDismissing(null)
            reload()
          }}
        />
      ) : null}
    </>
  )
}
