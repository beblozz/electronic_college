'use client'

import { FormEvent, useState } from 'react'
import { CredentialsPanel } from '@/components/admin/credentials-panel'
import { FieldConfig, ResourceConfig } from '@/components/admin/directory-config'
import { DirectoryRow, text, useDirectory } from '@/components/admin/use-directory'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Input, Select } from '@/components/ui/field'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import type { GeneratedCredentials } from '@/lib/types'

type RecordDialogProps = {
  config: ResourceConfig
  record: DirectoryRow | null
  onClose: () => void
  onSaved: () => void
}

type ReferenceField = Extract<FieldConfig, { type: 'reference' }>

function ReferenceSelect({
  field,
  value,
  onChange,
}: {
  field: ReferenceField
  value: string
  onChange: (value: string) => void
}) {
  const options = useDirectory(field.resource)
  return (
    <Select value={value} required={!field.isOptional} onChange={(event) => onChange(event.target.value)}>
      <option value="">{field.isOptional ? 'Не выбрано' : 'Выберите'}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {text(option, field.labelKey)}
        </option>
      ))}
    </Select>
  )
}

function initialValues(config: ResourceConfig, record: DirectoryRow | null): Record<string, string> {
  return Object.fromEntries(
    config.fields.map((field) => {
      const fallback = field.type === 'select' ? field.options[0].value : ''
      return [field.name, record ? text(record, field.name) : fallback]
    }),
  )
}

function toPayload(config: ResourceConfig, values: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(
    config.fields.map((field) => {
      const value = values[field.name]
      if (field.type === 'number') {
        return [field.name, Number(value)]
      }
      if (field.type === 'reference' && value === '') {
        return [field.name, null]
      }
      return [field.name, value]
    }),
  )
}

export function RecordDialog({ config, record, onClose, onSaved }: RecordDialogProps) {
  const [values, setValues] = useState(() => initialValues(config, record))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [credentials, setCredentials] = useState<GeneratedCredentials | null>(null)
  const setValue = (name: string, value: string) => setValues((current) => ({ ...current, [name]: value }))

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const url = record ? `/api/admin/${config.key}/${record.id}` : `/api/admin/${config.key}`
      const { item } = await apiFetch<{ item: DirectoryRow }>(url, {
        method: record ? 'PATCH' : 'POST',
        body: toPayload(config, values),
      })
      const generatedPassword = text(item, 'generatedPassword')
      if (!generatedPassword) {
        onSaved()
        return
      }
      setCredentials({ email: text(item, 'email'), fullName: text(item, 'fullName'), password: generatedPassword })
    } catch (reason) {
      setError(errorText(reason))
      setIsSaving(false)
    }
  }

  if (credentials) {
    return (
      <Dialog title="Учётная запись создана" onClose={onSaved}>
        <CredentialsPanel credentials={[credentials]} onDone={onSaved} />
      </Dialog>
    )
  }

  return (
    <Dialog title={record ? `${config.title}: изменение` : `${config.title}: новая запись`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error ? <ErrorState message={error} /> : null}
        {config.fields.map((field) => (
          <Field key={field.name} label={field.label}>
            {field.type === 'reference' ? (
              <ReferenceSelect field={field} value={values[field.name]} onChange={(value) => setValue(field.name, value)} />
            ) : field.type === 'select' ? (
              <Select value={values[field.name]} onChange={(event) => setValue(field.name, event.target.value)}>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                type={field.type}
                required={!field.isOptional}
                value={values[field.name]}
                onChange={(event) => setValue(field.name, event.target.value)}
              />
            )}
          </Field>
        ))}
        <div className="mt-1 flex justify-end gap-2">
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            Сохранить
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
