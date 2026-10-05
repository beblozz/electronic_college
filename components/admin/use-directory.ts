'use client'

import { useApi } from '@/lib/client/api'
import type { Page } from '@/lib/types'

export type DirectoryRow = Record<string, unknown> & { id: string }

export function useDirectory(resource: string | null, query = ''): DirectoryRow[] {
  const { data } = useApi<Page<DirectoryRow>>(resource ? `/api/admin/${resource}?limit=200${query}` : null)
  return data?.items ?? []
}

export function text(row: DirectoryRow | undefined, key: string): string {
  const value = row?.[key]
  return value === null || value === undefined ? '' : String(value)
}
