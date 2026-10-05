import type { Page } from '@/lib/types'

export type PageRequest = {
  limit: number
  args: { take: number; cursor?: { id: string }; skip?: number }
}

export function readPage(params: URLSearchParams, defaultLimit = 50): PageRequest {
  const requested = Number(params.get('limit') ?? defaultLimit)
  const limit = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), 200) : defaultLimit
  const cursor = params.get('cursor')
  return {
    limit,
    args: cursor ? { take: limit + 1, cursor: { id: cursor }, skip: 1 } : { take: limit + 1 },
  }
}

export function toPage<Row extends { id: string }, Item>(
  rows: Row[],
  limit: number,
  serialize: (row: Row) => Item,
): Page<Item> {
  const visible = rows.slice(0, limit)
  return {
    items: visible.map(serialize),
    nextCursor: rows.length > limit ? visible[visible.length - 1].id : null,
  }
}
