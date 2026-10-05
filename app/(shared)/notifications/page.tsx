'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRealtime, useSocketEvent } from '@/components/layout/realtime-provider'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import { describeNotification } from '@/lib/client/notification-text'
import { formatDateTime } from '@/lib/dates'
import type { NotificationDto, Page } from '@/lib/types'

export default function NotificationsPage() {
  const { refreshUnreadCount } = useRealtime()
  const [notifications, setNotifications] = useState<NotificationDto[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPage = async (cursor: string | null) => {
    try {
      const page = await apiFetch<Page<NotificationDto>>(
        `/api/notifications?limit=50${cursor ? `&cursor=${cursor}` : ''}`,
      )
      setNotifications((current) => (cursor ? [...current, ...page.items] : page.items))
      setNextCursor(page.nextCursor)
      setError(null)
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  useEffect(() => {
    loadPage(null)
  }, [])
  useSocketEvent('notification:new', () => loadPage(null))

  const markAllRead = async () => {
    try {
      await apiFetch('/api/notifications/read', { method: 'POST', body: {} })
      refreshUnreadCount()
      await loadPage(null)
    } catch (failure) {
      setError(errorText(failure))
    }
  }

  const hasUnread = notifications.some((notification) => !notification.readAt)

  return (
    <>
      <PageHeader title="Уведомления">
        <Button disabled={!hasUnread} onClick={markAllRead}>
          Отметить все прочитанными
        </Button>
      </PageHeader>
      {error ? <ErrorState message={error} /> : null}
      {notifications.length === 0 && !error ? <EmptyState>Уведомлений нет</EmptyState> : null}
      {notifications.length > 0 ? (
        <div className="rounded border border-line">
          {notifications.map((notification) => {
            const description = describeNotification(notification)
            return (
              <Link
                key={notification.id}
                href={description.href}
                className="flex items-start gap-3 border-b border-line px-3 py-2 transition-colors last:border-b-0 hover:bg-subtle"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-sm ${notification.readAt ? 'bg-transparent' : 'bg-accent'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block ${notification.readAt ? '' : 'font-medium'}`}>{description.title}</span>
                  <span className="block text-caption text-muted">{description.text}</span>
                </span>
                <span className="shrink-0 text-caption tabular-nums text-muted">
                  {formatDateTime(notification.createdAt)}
                </span>
              </Link>
            )
          })}
        </div>
      ) : null}
      {nextCursor ? (
        <Button className="mt-3" onClick={() => loadPage(nextCursor)}>
          Показать ещё
        </Button>
      ) : null}
    </>
  )
}
