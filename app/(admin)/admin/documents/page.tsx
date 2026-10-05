'use client'

import { Trash2 } from 'lucide-react'
import { FormEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import { formatDateTime } from '@/lib/dates'
import type { KnowledgeDocumentDto } from '@/lib/types'

export default function AdminDocumentsPage() {
  const documents = useApi<{ items: KnowledgeDocumentDto[] }>('/api/admin/documents')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const upload = async (event: FormEvent) => {
    event.preventDefault()
    const file = fileInput.current?.files?.[0]
    if (!file) {
      setError('Выберите файл')
      return
    }
    const formData = new FormData()
    formData.set('file', file)
    formData.set('title', title)
    setIsUploading(true)
    try {
      await apiFetch('/api/admin/documents', { method: 'POST', formData })
      setTitle('')
      if (fileInput.current) {
        fileInput.current.value = ''
      }
      setError(null)
      documents.reload()
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsUploading(false)
    }
  }

  const remove = async (documentId: string) => {
    try {
      await apiFetch(`/api/admin/documents/${documentId}`, { method: 'DELETE' })
      documents.reload()
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  return (
    <>
      <PageHeader title="Документы колледжа" caption="По этим документам отвечает помощник. Форматы: pdf, docx, txt, md до 10 МБ" />

      <form onSubmit={upload} className="mb-4 flex flex-wrap items-end gap-3 rounded border border-line p-3">
        <Field label="Название" className="w-64">
          <Input value={title} placeholder="Правила внутреннего распорядка" onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Файл">
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            className="block h-8 text-body file:mr-2 file:h-8 file:rounded file:border file:border-solid file:border-line file:bg-surface file:px-3 file:text-body"
          />
        </Field>
        <Button type="submit" variant="primary" disabled={isUploading}>
          {isUploading ? 'Обработка…' : 'Загрузить'}
        </Button>
      </form>

      {error ?? documents.error ? (
        <div className="mb-3">
          <ErrorState message={error ?? documents.error ?? ''} />
        </div>
      ) : null}
      {!documents.data && documents.isLoading ? <LoadingState /> : null}
      {documents.data?.items.length === 0 ? <EmptyState>Документы ещё не загружены</EmptyState> : null}
      {documents.data && documents.data.items.length > 0 ? (
        <Table>
          <thead>
            <tr>
              <Th>Название</Th>
              <Th>Файл</Th>
              <Th className="text-right">Фрагментов</Th>
              <Th>Загружен</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {documents.data.items.map((document) => (
              <tr key={document.id}>
                <Td className="font-medium">{document.title}</Td>
                <Td className="text-muted">{document.fileName}</Td>
                <Td className="text-right tabular-nums">{document.chunkCount}</Td>
                <Td className="tabular-nums text-muted">{formatDateTime(document.createdAt)}</Td>
                <Td className="w-px text-right">
                  <Button size="small" variant="ghost" aria-label="Удалить" onClick={() => remove(document.id)}>
                    <Trash2 size={16} strokeWidth={1.5} />
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </>
  )
}
