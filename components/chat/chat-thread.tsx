'use client'

import { Send } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useRealtime, useSocketEvent } from '@/components/layout/realtime-provider'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import { formatDateTime } from '@/lib/dates'
import type { ChatMessage, ChatSummary, Page } from '@/lib/types'

type ChatThreadProps = { chat: ChatSummary; currentUserId: string; onActivity: () => void }

type SendAcknowledgement = { ok: true; message: ChatMessage } | { ok: false; error: string }

const typingIdleMilliseconds = 2500
const pageSize = 50

export function ChatThread({ chat, currentUserId, onActivity }: ChatThreadProps) {
  const { socket } = useRealtime()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [olderCursor, setOlderCursor] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [typingUserIds, setTypingUserIds] = useState<string[]>([])
  const bottomAnchor = useRef<HTMLDivElement>(null)
  const typingTimer = useRef<number | null>(null)
  const isTyping = useRef(false)

  const markRead = useCallback(
    (lastMessage: ChatMessage | undefined) => {
      if (!lastMessage || lastMessage.sender.id === currentUserId) {
        return
      }
      apiFetch(`/api/chats/${chat.id}/read`, { method: 'POST', body: { lastMessageId: lastMessage.id } })
        .then(onActivity)
        .catch(() => undefined)
    },
    [chat.id, currentUserId, onActivity],
  )

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message]))
  }, [])

  useEffect(() => {
    let isCurrent = true
    setMessages([])
    setTypingUserIds([])
    apiFetch<Page<ChatMessage>>(`/api/chats/${chat.id}/messages?limit=${pageSize}`)
      .then((page) => {
        if (!isCurrent) {
          return
        }
        const ordered = [...page.items].reverse()
        setMessages(ordered)
        setOlderCursor(page.nextCursor)
        setError(null)
        markRead(ordered[ordered.length - 1])
      })
      .catch((failure) => setError(errorText(failure)))
    return () => {
      isCurrent = false
    }
  }, [chat.id, markRead])

  useEffect(() => {
    bottomAnchor.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  useSocketEvent<{ message: ChatMessage }>('message:new', ({ message }) => {
    if (message.chatId !== chat.id) {
      return
    }
    appendMessage(message)
    setTypingUserIds((current) => current.filter((userId) => userId !== message.sender.id))
    markRead(message)
  })

  useSocketEvent<{ chatId: string; userId: string; readAt: string }>('message:read', (receipt) => {
    if (receipt.chatId !== chat.id || receipt.userId === currentUserId) {
      return
    }
    setMessages((current) =>
      current.map((message) =>
        message.sender.id === currentUserId && !message.readAt ? { ...message, readAt: receipt.readAt } : message,
      ),
    )
  })

  useSocketEvent<{ chatId: string; userId: string }>('typing:start', ({ chatId, userId }) => {
    if (chatId === chat.id) {
      setTypingUserIds((current) => (current.includes(userId) ? current : [...current, userId]))
    }
  })

  useSocketEvent<{ chatId: string; userId: string }>('typing:stop', ({ chatId, userId }) => {
    if (chatId === chat.id) {
      setTypingUserIds((current) => current.filter((item) => item !== userId))
    }
  })

  const stopTyping = () => {
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current)
      typingTimer.current = null
    }
    if (isTyping.current) {
      isTyping.current = false
      socket?.emit('typing:stop', { chatId: chat.id })
    }
  }

  const handleDraftChange = (value: string) => {
    setDraft(value)
    if (!isTyping.current) {
      isTyping.current = true
      socket?.emit('typing:start', { chatId: chat.id })
    }
    if (typingTimer.current) {
      window.clearTimeout(typingTimer.current)
    }
    typingTimer.current = window.setTimeout(stopTyping, typingIdleMilliseconds)
  }

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    const content = draft.trim()
    if (!content) {
      return
    }
    setDraft('')
    stopTyping()
    try {
      if (socket?.connected) {
        const acknowledgement: SendAcknowledgement = await socket.emitWithAck('message:send', { chatId: chat.id, content })
        if (!acknowledgement.ok) {
          throw new Error(acknowledgement.error)
        }
        appendMessage(acknowledgement.message)
      } else {
        const { message } = await apiFetch<{ message: ChatMessage }>(`/api/chats/${chat.id}/messages`, {
          method: 'POST',
          body: { content },
        })
        appendMessage(message)
      }
      setError(null)
      onActivity()
    } catch (failure) {
      setDraft(content)
      setError(errorText(failure))
    }
  }

  const loadOlder = async () => {
    if (!olderCursor) {
      return
    }
    try {
      const page = await apiFetch<Page<ChatMessage>>(
        `/api/chats/${chat.id}/messages?limit=${pageSize}&cursor=${olderCursor}`,
      )
      setMessages((current) => [...[...page.items].reverse(), ...current])
      setOlderCursor(page.nextCursor)
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  const lastOwnMessage = [...messages].reverse().find((message) => message.sender.id === currentUserId)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {olderCursor ? (
          <div className="mb-3 text-center">
            <Button size="small" variant="ghost" onClick={loadOlder}>
              Показать ранние сообщения
            </Button>
          </div>
        ) : null}
        {messages.length === 0 ? <p className="text-caption text-muted">Сообщений пока нет</p> : null}
        <div className="flex flex-col gap-2.5">
          {messages.map((message) => {
            const isOwn = message.sender.id === currentUserId
            return (
              <div key={message.id}>
                <p className="text-caption text-muted">
                  <span className={isOwn ? 'text-accent' : 'text-ink'}>
                    {message.sender.lastName} {message.sender.firstName}
                  </span>
                  <span className="ml-2 tabular-nums">{formatDateTime(message.createdAt)}</span>
                  {chat.type === 'PRIVATE' && message.id === lastOwnMessage?.id && message.readAt ? (
                    <span className="ml-2">прочитано</span>
                  ) : null}
                </p>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            )
          })}
        </div>
        <div ref={bottomAnchor} />
      </div>

      <div className="border-t border-line px-4 py-2">
        <p className="h-4 text-caption text-muted">{typingUserIds.length > 0 ? 'Собеседник печатает…' : ''}</p>
        {error ? (
          <div className="mb-2">
            <ErrorState message={error} />
          </div>
        ) : null}
        <form onSubmit={send} className="flex items-end gap-2">
          <Textarea
            rows={2}
            className="resize-none"
            value={draft}
            maxLength={4000}
            placeholder="Сообщение"
            onChange={(event) => handleDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                send()
              }
            }}
          />
          <Button type="submit" variant="primary" aria-label="Отправить" disabled={draft.trim().length === 0}>
            <Send size={16} strokeWidth={1.5} />
          </Button>
        </form>
      </div>
    </div>
  )
}
