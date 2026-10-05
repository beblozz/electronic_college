'use client'

import Link from 'next/link'
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { apiFetch } from '@/lib/client/api'
import { describeNotification, NotificationText } from '@/lib/client/notification-text'
import type { NotificationDto } from '@/lib/types'

type RealtimeContextValue = {
  socket: Socket | null
  unreadCount: number
  refreshUnreadCount: () => void
}

type Toast = NotificationText & { id: string }

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  unreadCount: 0,
  refreshUnreadCount: () => undefined,
})

const toastLifetimeMilliseconds = 7000

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext)
}

export function useSocketEvent<Payload>(event: string, handler: (payload: Payload) => void): void {
  const { socket } = useRealtime()
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!socket) {
      return
    }
    const listener = (payload: Payload) => handlerRef.current(payload)
    socket.on(event, listener)
    return () => {
      socket.off(event, listener)
    }
  }, [socket, event])
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])

  const refreshUnreadCount = useCallback(() => {
    apiFetch<{ unreadCount: number }>('/api/notifications?limit=1')
      .then((result) => setUnreadCount(result.unreadCount))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    refreshUnreadCount()
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL
    if (!socketUrl) {
      return
    }
    const connection = io(socketUrl, { withCredentials: true })
    setSocket(connection)

    connection.on('notification:new', ({ notification }: { notification: NotificationDto }) => {
      setUnreadCount((current) => current + 1)
      const toast: Toast = { ...describeNotification(notification), id: notification.id }
      setToasts((current) => [...current, toast])
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id))
      }, toastLifetimeMilliseconds)
    })

    return () => {
      connection.disconnect()
      setSocket(null)
    }
  }, [refreshUnreadCount])

  return (
    <RealtimeContext.Provider value={{ socket, unreadCount, refreshUnreadCount }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-72 flex-col gap-2">
        {toasts.map((toast) => (
          <Link
            key={toast.id}
            href={toast.href}
            className="pointer-events-auto rounded-md border border-line bg-surface px-3 py-2 shadow-popover transition-colors hover:bg-subtle"
          >
            <p className="text-body font-medium">{toast.title}</p>
            <p className="text-caption text-muted">{toast.text}</p>
          </Link>
        ))}
      </div>
    </RealtimeContext.Provider>
  )
}
