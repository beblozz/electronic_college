'use client'

import { useState } from 'react'
import { CredentialsPanel } from '@/components/admin/credentials-panel'
import { DirectoryRow, text } from '@/components/admin/use-directory'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import type { GeneratedCredentials } from '@/lib/types'

export function ResetPasswordDialog({ record, onClose }: { record: DirectoryRow; onClose: () => void }) {
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const reset = async () => {
    setIsSaving(true)
    try {
      const result = await apiFetch<{ credentials: GeneratedCredentials }>(
        `/api/admin/users/${text(record, 'userId')}/password`,
        { method: 'POST' },
      )
      setCredentials(result.credentials)
    } catch (failure) {
      setError(errorText(failure))
      setIsSaving(false)
    }
  }

  return (
    <Dialog title={`Новый пароль: ${text(record, 'fullName')}`} onClose={onClose}>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      {credentials ? (
        <CredentialsPanel credentials={[credentials]} onDone={onClose} />
      ) : (
        <>
          <p>Будет создан новый пароль для входа по почте {text(record, 'email')}. Старый перестанет работать.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={onClose}>Отмена</Button>
            <Button variant="primary" disabled={isSaving} onClick={reset}>
              Создать пароль
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}
