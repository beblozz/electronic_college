'use client'

import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/field'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import type { ChatContact, ChatSummary } from '@/lib/types'

type NewChatDialogProps = { onClose: () => void; onCreated: (chat: ChatSummary) => void }

export function NewChatDialog({ onClose, onCreated }: NewChatDialogProps) {
  const contacts = useApi<{ contacts: ChatContact[] }>('/api/chats/contacts')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const visibleContacts = (contacts.data?.contacts ?? []).filter((contact) =>
    `${contact.lastName} ${contact.firstName} ${contact.caption}`.toLowerCase().includes(search.trim().toLowerCase()),
  )

  const open = async (userId: string) => {
    try {
      const { chat } = await apiFetch<{ chat: ChatSummary }>('/api/chats/private', { method: 'POST', body: { userId } })
      onCreated(chat)
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  return (
    <Dialog title="Личный чат" onClose={onClose}>
      {error ?? contacts.error ? (
        <div className="mb-3">
          <ErrorState message={error ?? contacts.error ?? ''} />
        </div>
      ) : null}
      <Input placeholder="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} />
      {!contacts.data ? <LoadingState /> : null}
      <div className="mt-2 max-h-[50vh] overflow-y-auto rounded border border-line">
        {contacts.data && visibleContacts.length === 0 ? (
          <p className="px-3 py-3 text-caption text-muted">Никого не найдено</p>
        ) : null}
        {visibleContacts.map((contact) => (
          <button
            key={contact.id}
            type="button"
            onClick={() => open(contact.id)}
            className="flex w-full items-center justify-between gap-3 border-b border-line px-3 py-1.5 text-left transition-colors last:border-b-0 hover:bg-subtle"
          >
            <span className="truncate">
              {contact.lastName} {contact.firstName}
            </span>
            <span className="shrink-0 truncate text-caption text-muted">{contact.caption}</span>
          </button>
        ))}
      </div>
    </Dialog>
  )
}
