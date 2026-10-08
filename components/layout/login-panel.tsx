'use client'

import { FormEvent, useState } from 'react'
import { roleLabels } from '@/components/layout/navigation'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import type { Role } from '@/lib/types'

type DevUser = { id: string; fullName: string; role: Role; caption: string }

type LoginPanelProps = { isGoogleConfigured: boolean; isDevLoginAllowed: boolean }

export function LoginPanel({ isGoogleConfigured, isDevLoginAllowed }: LoginPanelProps) {
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const devUsers = useApi<{ users: DevUser[] }>(isDevLoginAllowed ? '/api/auth/dev-users' : null)

  const startGoogleLogin = async () => {
    try {
      const { url } = await apiFetch<{ url: string }>('/api/auth/google/url')
      window.location.assign(url)
    } catch (reason) {
      setError(errorText(reason))
    }
  }

  const logInWithPassword = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } })
      window.location.assign('/')
    } catch (reason) {
      setError(errorText(reason))
      setIsSubmitting(false)
    }
  }

  const logInAs = async (userId: string) => {
    try {
      await apiFetch('/api/auth/dev-login', { method: 'POST', body: { userId } })
      window.location.assign('/')
    } catch (reason) {
      setError(errorText(reason))
    }
  }

  return (
    <div className="rounded-lg border border-line p-5">
      <h1 className="text-title font-medium">Электронный колледж</h1>
      <p className="mb-4 mt-1 text-caption text-muted">
        Войдите по почте и паролю, которые выдала учебная часть.
      </p>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      <form onSubmit={logInWithPassword} className="flex flex-col gap-3">
        <Field label="Почта">
          <Input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Пароль">
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
          Войти
        </Button>
      </form>
      {isGoogleConfigured ? (
        <Button className="mt-2 w-full" onClick={startGoogleLogin}>
          Войти через Google
        </Button>
      ) : null}

      {isDevLoginAllowed ? (
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-caption text-muted">Режим разработки: вход без Google</p>
          <div className="max-h-72 overflow-y-auto rounded border border-line">
            {(devUsers.data?.users ?? []).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => logInAs(user.id)}
                className="flex w-full items-center justify-between gap-2 border-b border-line px-2.5 py-1.5 text-left transition-colors last:border-b-0 hover:bg-subtle"
              >
                <span className="truncate">{user.fullName}</span>
                <span className="shrink-0 text-caption text-muted">
                  {roleLabels[user.role]} · {user.caption}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
