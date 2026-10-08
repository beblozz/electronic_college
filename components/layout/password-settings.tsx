'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Section } from '@/components/ui/section'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'

export function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setIsSaved(false)
    try {
      await apiFetch('/api/auth/password', { method: 'POST', body: { currentPassword, newPassword } })
      setCurrentPassword('')
      setNewPassword('')
      setError(null)
      setIsSaved(true)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Section title="Пароль">
      <form onSubmit={submit} className="flex flex-col gap-3 rounded border border-line p-3">
        {error ? <ErrorState message={error} /> : null}
        {isSaved ? <p className="text-caption text-green-800">Пароль изменён</p> : null}
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Текущий пароль">
            <Input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <Field label="Новый пароль, не короче 8 символов">
            <Input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
        </div>
        <p className="text-caption text-muted">
          Если вы входили только через Google и пароля ещё нет, поле текущего пароля оставьте пустым.
        </p>
        <div>
          <Button type="submit" variant="primary" disabled={isSaving}>
            Сменить пароль
          </Button>
        </div>
      </form>
    </Section>
  )
}
