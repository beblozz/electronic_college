'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/ui/section'
import { ErrorState } from '@/components/ui/states'
import { errorText } from '@/lib/client/api'
import { disablePush, enablePush, PushStatus, readPushStatus } from '@/lib/client/push'

const statusTexts: Record<PushStatus, string> = {
  unsupported: 'Этот браузер не поддерживает push-уведомления.',
  unconfigured: 'Push-уведомления не настроены на сервере: не заданы ключи VAPID.',
  denied: 'Уведомления запрещены в настройках браузера для этого сайта.',
  enabled: 'Уведомления включены в этом браузере.',
  disabled: 'Уведомления выключены в этом браузере.',
}

export function PushSettings() {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  useEffect(() => {
    readPushStatus()
      .then(setStatus)
      .catch((failure) => setError(errorText(failure)))
  }, [])

  const change = async (action: () => Promise<PushStatus>) => {
    setIsBusy(true)
    try {
      setStatus(await action())
      setError(null)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Section title="Push-уведомления">
      <div className="rounded border border-line p-3">
        <p className="text-caption text-muted">Замены, новые оценки и объявления приходят, даже когда вкладка закрыта.</p>
        {error ? (
          <div className="mt-2">
            <ErrorState message={error} />
          </div>
        ) : null}
        <p className="mt-2">{status ? statusTexts[status] : 'Проверка…'}</p>
        {status === 'disabled' ? (
          <Button className="mt-2" variant="primary" disabled={isBusy} onClick={() => change(enablePush)}>
            Включить
          </Button>
        ) : null}
        {status === 'enabled' ? (
          <Button className="mt-2" disabled={isBusy} onClick={() => change(disablePush)}>
            Выключить
          </Button>
        ) : null}
      </div>
    </Section>
  )
}
