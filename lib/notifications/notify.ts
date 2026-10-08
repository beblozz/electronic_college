import type { Prisma } from '@prisma/client'
import { PushMessage, sendPushToUsers } from '@/lib/notifications/web-push'
import { prisma } from '@/lib/prisma'
import { emitToRooms, userRoom } from '@/lib/socket'
import type { NotificationDto, NotificationType } from '@/lib/types'

type NotifyOptions = {
  userIds: string[]
  type: NotificationType
  payload: Prisma.InputJsonObject
  push: PushMessage
}

export function serializeNotification(notification: {
  id: string
  type: NotificationType
  payload: Prisma.JsonValue
  readAt: Date | null
  createdAt: Date
}): NotificationDto {
  return {
    id: notification.id,
    type: notification.type,
    payload: (notification.payload ?? {}) as Record<string, unknown>,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }
}

export async function notifyUsers(options: NotifyOptions): Promise<void> {
  const userIds = [...new Set(options.userIds)]
  if (userIds.length === 0) {
    return
  }
  const notifications = await prisma.notification.createManyAndReturn({
    data: userIds.map((userId) => ({ userId, type: options.type, payload: options.payload })),
  })
  await Promise.all([
    ...notifications.map((notification) =>
      emitToRooms([userRoom(notification.userId)], 'notification:new', {
        notification: serializeNotification(notification),
      }),
    ),
    sendPushToUsers(userIds, options.push),
  ])
}
