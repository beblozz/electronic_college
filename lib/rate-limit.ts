import { rateLimited } from '@/lib/http'

const hitsByKey = new Map<string, number[]>()

export function assertRateLimit(key: string, limit: number, windowMilliseconds: number, message: string): void {
  const now = Date.now()
  const recentHits = (hitsByKey.get(key) ?? []).filter((timestamp) => now - timestamp < windowMilliseconds)
  if (recentHits.length >= limit) {
    hitsByKey.set(key, recentHits)
    throw rateLimited(message)
  }
  recentHits.push(now)
  hitsByKey.set(key, recentHits)
}
