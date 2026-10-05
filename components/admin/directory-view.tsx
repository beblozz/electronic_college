'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BulkStudentsDialog } from '@/components/admin/bulk-students-dialog'
import { ResourceConfig, resourceConfigs } from '@/components/admin/directory-config'
import { RecordDialog } from '@/components/admin/record-dialog'
import { ResetPasswordDialog } from '@/components/admin/reset-password-dialog'
import { TeacherSubjectsDialog } from '@/components/admin/teacher-subjects-dialog'
import { DirectoryRow, text } from '@/components/admin/use-directory'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { apiFetch, errorText } from '@/lib/client/api'
import type { Page } from '@/lib/types'

type DialogState =
  | { kind: 'record'; record: DirectoryRow | null }
  | { kind: 'subjects'; record: DirectoryRow }
  | { kind: 'password'; record: DirectoryRow }
  | { kind: 'bulk' }
  | null

const searchDelayMilliseconds = 250

export function DirectoryView({ config }: { config: ResourceConfig }) {
  const [rows, setRows] = useState<DirectoryRow[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<DialogState>(null)

  const loadPage = async (cursor: string | null, searchText: string) => {
    const params = new URLSearchParams({ limit: '100' })
    if (cursor) {
      params.set('cursor', cursor)
    }
    if (searchText.trim()) {
      params.set('search', searchText.trim())
    }
    try {
      const page = await apiFetch<Page<DirectoryRow>>(`/api/admin/${config.key}?${params.toString()}`)
      setRows((current) => (cursor ? [...current, ...page.items] : page.items))
      setNextCursor(page.nextCursor)
      setError(null)
    } catch (reason) {
      setError(errorText(reason))
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadPage(null, search), searchDelayMilliseconds)
    return () => window.clearTimeout(timer)
  }, [search, config.key])

  const remove = async (row: DirectoryRow) => {
    if (!window.confirm('Удалить запись?')) {
      return
    }
    try {
      await apiFetch(`/api/admin/${config.key}/${row.id}`, { method: 'DELETE' })
      await loadPage(null, search)
    } catch (reason) {
      setError(errorText(reason))
    }
  }

  const hasAccounts = config.key === 'students' || config.key === 'teachers'

  const closeAndReload = () => {
    setDialog(null)
    loadPage(null, search)
  }

  return (
    <>
      <PageHeader title="Справочники">
        {config.hasSearch ? (
          <Input
            className="!w-56"
            placeholder="Поиск"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        ) : null}
        {config.key === 'students' ? <Button onClick={() => setDialog({ kind: 'bulk' })}>Добавить списком</Button> : null}
        <Button variant="primary" onClick={() => setDialog({ kind: 'record', record: null })}>
          <Plus size={16} strokeWidth={1.5} />
          Добавить
        </Button>
      </PageHeader>

      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
        {resourceConfigs.map((item) => (
          <Link
            key={item.key}
            href={`/admin/directory/${item.key}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-2.5 py-1.5 transition-colors ${
              item.key === config.key
                ? 'border-accent font-medium text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {item.title}
          </Link>
        ))}
      </div>

      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState>Записей нет</EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              {config.columns.map((column) => (
                <Th key={column.key}>{column.label}</Th>
              ))}
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {config.columns.map((column, index) => {
                  const raw = text(row, column.key)
                  const value = column.labels?.[raw] ?? raw
                  return (
                    <Td key={column.key} className={index === 0 ? 'font-medium' : ''}>
                      {value === '' ? <span className="text-muted">—</span> : value}
                    </Td>
                  )
                })}
                <Td className="w-px whitespace-nowrap text-right">
                  {config.key === 'teachers' ? (
                    <Button size="small" variant="ghost" onClick={() => setDialog({ kind: 'subjects', record: row })}>
                      Предметы
                    </Button>
                  ) : null}
                  {hasAccounts ? (
                    <Button size="small" variant="ghost" onClick={() => setDialog({ kind: 'password', record: row })}>
                      Пароль
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    variant="ghost"
                    aria-label="Изменить"
                    onClick={() => setDialog({ kind: 'record', record: row })}
                  >
                    <Pencil size={16} strokeWidth={1.5} />
                  </Button>
                  <Button size="small" variant="ghost" aria-label="Удалить" onClick={() => remove(row)}>
                    <Trash2 size={16} strokeWidth={1.5} />
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {nextCursor ? (
        <Button className="mt-3" onClick={() => loadPage(nextCursor, search)}>
          Показать ещё
        </Button>
      ) : null}

      {dialog?.kind === 'record' ? (
        <RecordDialog config={config} record={dialog.record} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      ) : null}
      {dialog?.kind === 'password' ? (
        <ResetPasswordDialog record={dialog.record} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === 'bulk' ? <BulkStudentsDialog onClose={() => setDialog(null)} onSaved={closeAndReload} /> : null}
      {dialog?.kind === 'subjects' ? (
        <TeacherSubjectsDialog teacher={dialog.record} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      ) : null}
    </>
  )
}
