'use client'

import { apiFetch } from '@/lib/client/api'

export type PushStatus = 'unsupported' | 'unconfigured' | 'denied' | 'enabled' | 'disabled'

function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function decodeServerKey(publicKey: string): ArrayBuffer {
  const padding = '='.repeat((4 - (publicKey.length % 4)) % 4)
  const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }
  return bytes.buffer
}

async function fetchPublicKey(): Promise<string | null> {
  const { publicKey } = await apiFetch<{ publicKey: string | null }>('/api/push/public-key')
  return publicKey
}

export async function readPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) {
    return 'unsupported'
  }
  if (!(await fetchPublicKey())) {
    return 'unconfigured'
  }
  if (Notification.permission === 'denied') {
    return 'denied'
  }
  const registration = await navigator.serviceWorker.getRegistration('/service-worker.js')
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? 'enabled' : 'disabled'
}

export async function enablePush(): Promise<PushStatus> {
  const publicKey = await fetchPublicKey()
  if (!publicKey) {
    return 'unconfigured'
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return permission === 'denied' ? 'denied' : 'disabled'
  }
  await navigator.serviceWorker.register('/service-worker.js')
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeServerKey(publicKey),
  })
  const serialized = subscription.toJSON()
  await apiFetch('/api/push/subscribe', {
    method: 'POST',
    body: { endpoint: serialized.endpoint, keys: serialized.keys },
  })
  return 'enabled'
}

export async function disablePush(): Promise<PushStatus> {
  const registration = await navigator.serviceWorker.getRegistration('/service-worker.js')
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) {
    await apiFetch('/api/push/unsubscribe', { method: 'POST', body: { endpoint: subscription.endpoint } })
    await subscription.unsubscribe()
  }
  return 'disabled'
}
