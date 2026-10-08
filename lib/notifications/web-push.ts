import webPush from 'web-push'
import { prisma } from '@/lib/prisma'

export type PushMessage = { title: string; body: string; url: string }

let isConfigured = false

function configure(): boolean {
  if (isConfigured) {
    return true
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    return false
  }
  webPush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com', publicKey, privateKey)
  isConfigured = true
  return true
}

export async function sendPushToUsers(userIds: string[], message: PushMessage): Promise<void> {
  if (userIds.length === 0 || !configure()) {
    return
  }
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } })
  const expiredEndpoints: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(message),
        )
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          expiredEndpoints.push(subscription.endpoint)
        }
      }
    }),
  )

  if (expiredEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expiredEndpoints } } })
  }
}
