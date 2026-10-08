'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'

type OauthCallbackProps = { endpoint: string; successPath: string; failurePath: string }

export function OauthCallback({ endpoint, successPath, failurePath }: OauthCallbackProps) {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (hasStarted.current) {
      return
    }
    hasStarted.current = true
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (!code || !state) {
      setError('Google не вернул код авторизации')
      return
    }
    apiFetch(endpoint, { method: 'POST', body: { code, state } })
      .then(() => window.location.assign(successPath))
      .catch((reason) => setError(errorText(reason)))
  }, [endpoint, searchParams, successPath])

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 px-4">
      {error ? (
        <>
          <ErrorState message={error} />
          <Link href={failurePath} className="text-accent hover:underline">
            Вернуться
          </Link>
        </>
      ) : (
        <p className="text-muted">Завершаем авторизацию…</p>
      )}
    </main>
  )
}
