'use client'

import { FormEvent, useState } from 'react'
import { CredentialsPanel } from '@/components/admin/credentials-panel'
import { text, useDirectory } from '@/components/admin/use-directory'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import type { GeneratedCredentials } from '@/lib/types'

type ParsedStudent = { email: string; lastName: string; firstName: string }

function parseLines(source: string): ParsedStudent[] {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const [email, lastName, firstName] = line.split(/[;,\t]/).map((part) => part.trim())
      if (!email || !lastName || !firstName) {
        throw new Error(`Строка ${index + 1}: нужны почта, фамилия и имя через точку с запятой`)
      }
      return { email, lastName, firstName }
    })
}

export function BulkStudentsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const groups = useDirectory('groups')
  const [groupId, setGroupId] = useState('')
  const [enrollmentYear, setEnrollmentYear] = useState(() => String(new Date().getFullYear()))
  const [source, setSource] = useState('')
  const [credentials, setCredentials] = useState<GeneratedCredentials[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const result = await apiFetch<{ credentials: GeneratedCredentials[] }>('/api/admin/students/bulk', {
        method: 'POST',
        body: { groupId, enrollmentYear: Number(enrollmentYear), students: parseLines(source) },
      })
      setCredentials(result.credentials)
      setError(null)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog title="Добавить студентов списком" width="wide" onClose={credentials ? onSaved : onClose}>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      {credentials ? (
        <CredentialsPanel credentials={credentials} onDone={onSaved} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Группа">
              <Select value={groupId} required onChange={(event) => setGroupId(event.target.value)}>
                <option value="">Выберите</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {text(group, 'name')}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Год поступления">
              <Input
                type="number"
                required
                value={enrollmentYear}
                onChange={(event) => setEnrollmentYear(event.target.value)}
              />
            </Field>
          </div>
          <Field label="По одному студенту в строке: почта; фамилия; имя">
            <Textarea
              required
              rows={10}
              className="font-mono"
              placeholder={'ivanov@example.com; Иванов; Алексей\npetrova@example.com; Петрова; Мария'}
              value={source}
              onChange={(event) => setSource(event.target.value)}
            />
          </Field>
          <p className="text-caption text-muted">
            Каждому студенту будет создан пароль. До 100 студентов за один раз.
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Отмена</Button>
            <Button type="submit" variant="primary" disabled={isSaving}>
              Добавить и создать пароли
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
