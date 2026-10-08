'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { GeneratedCredentials } from '@/lib/types'

type CredentialsPanelProps = { credentials: GeneratedCredentials[]; onDone: () => void }

export function CredentialsPanel({ credentials, onDone }: CredentialsPanelProps) {
  const [isCopied, setIsCopied] = useState(false)

  const copyAll = async () => {
    const text = credentials.map((item) => `${item.fullName}\t${item.email}\t${item.password}`).join('\n')
    await navigator.clipboard.writeText(text)
    setIsCopied(true)
  }

  return (
    <div>
      <p className="mb-2 text-caption text-muted">
        Пароли показываются один раз и не хранятся в открытом виде. Скопируйте их и передайте пользователям: сменить
        пароль можно в настройках.
      </p>
      <div className="max-h-[50vh] overflow-y-auto rounded border border-line">
        {credentials.map((item) => (
          <div key={item.email} className="flex flex-wrap items-center gap-x-4 border-b border-line px-3 py-1.5 last:border-b-0">
            <span className="min-w-0 flex-1 truncate">
              {item.fullName}
              <span className="ml-2 text-caption text-muted">{item.email}</span>
            </span>
            <code className="select-all rounded bg-subtle px-1.5 py-0.5 font-mono text-body">{item.password}</code>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={copyAll}>{isCopied ? 'Скопировано' : 'Скопировать всё'}</Button>
        <Button variant="primary" onClick={onDone}>
          Готово
        </Button>
      </div>
    </div>
  )
}
