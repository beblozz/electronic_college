'use client'

import { useCallback, useEffect, useState } from 'react'

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details: unknown,
  ) {
    super(message)
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  formData?: FormData
}

export async function apiFetch<Result>(url: string, options: RequestOptions = {}): Promise<Result> {
  const init: RequestInit = { method: options.method ?? 'GET', credentials: 'same-origin' }
  if (options.formData) {
    init.body = options.formData
  } else if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
    init.headers = { 'content-type': 'application/json' }
  }

  const response = await fetch(url, init)
  if (response.status === 204) {
    return undefined as Result
  }
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401 && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login')
    }
    throw new ApiClientError(
      payload?.error?.message ?? 'Не удалось выполнить запрос',
      response.status,
      payload?.error?.code ?? 'UNKNOWN',
      payload?.error?.details ?? {},
    )
  }
  return payload as Result
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос'
}

type ApiState<Result> = {
  data: Result | null
  error: string | null
  isLoading: boolean
  reload: () => void
}

export function useApi<Result>(url: string | null): ApiState<Result> {
  const [data, setData] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(url !== null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (url === null) {
      setData(null)
      setIsLoading(false)
      return
    }
    let isCurrent = true
    setIsLoading(true)
    apiFetch<Result>(url)
      .then((result) => {
        if (isCurrent) {
          setData(result)
          setError(null)
        }
      })
      .catch((reason) => {
        if (isCurrent) {
          setError(errorText(reason))
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false)
        }
      })
    return () => {
      isCurrent = false
    }
  }, [url, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])
  return { data, error, isLoading, reload }
}
