'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { Section } from '@/components/ui/section'
import { ErrorState, LoadingState } from '@/components/ui/states'
import { apiFetch, errorText, useApi } from '@/lib/client/api'
import { shiftDate, todayLocal } from '@/lib/dates'

type FeedState = { url: string; isGoogleConnected: boolean; isGoogleConfigured: boolean }
type SyncResult = { created: number; updated: number; deleted: number }

const defaultSyncDays = 27

export function CalendarSettings() {
  const feed = useApi<FeedState>('/api/calendar/feed')
  const [from, setFrom] = useState(() => todayLocal())
  const [to, setTo] = useState(() => shiftDate(todayLocal(), defaultSyncDays))
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const run = async (action: () => Promise<string | null>) => {
    setIsBusy(true)
    try {
      setMessage(await action())
      setError(null)
    } catch (failure) {
      setError(errorText(failure))
    } finally {
      setIsBusy(false)
    }
  }

  const copyUrl = () =>
    run(async () => {
      await navigator.clipboard.writeText(feed.data?.url ?? '')
      return 'Ссылка скопирована'
    })

  const rotateUrl = () =>
    run(async () => {
      await apiFetch('/api/calendar/feed/rotate', { method: 'POST' })
      feed.reload()
      return 'Ссылка перевыпущена, старая больше не работает'
    })

  const connectGoogle = () =>
    run(async () => {
      const { url } = await apiFetch<{ url: string }>('/api/calendar/google/url')
      window.location.assign(url)
      return null
    })

  const disconnectGoogle = () =>
    run(async () => {
      await apiFetch('/api/calendar/google/connect', { method: 'DELETE' })
      feed.reload()
      return 'Google Calendar отключён'
    })

  const syncGoogle = () =>
    run(async () => {
      const result = await apiFetch<SyncResult>('/api/calendar/google/sync', { method: 'POST', body: { from, to } })
      return `Выгружено в календарь «Колледж»: добавлено ${result.created}, обновлено ${result.updated}, удалено ${result.deleted}`
    })

  if (feed.error) {
    return <ErrorState message={feed.error} />
  }
  if (!feed.data) {
    return <LoadingState />
  }

  return (
    <Section title="Календарь">
      <div className="flex flex-col gap-4 rounded border border-line p-3">
        {error ? <ErrorState message={error} /> : null}
        {message ? <p className="text-caption text-green-800">{message}</p> : null}

        <div>
          <Field label="Ссылка на расписание в формате iCalendar">
            <Input readOnly value={feed.data.url} onFocus={(event) => event.target.select()} />
          </Field>
          <p className="mt-1 text-caption text-muted">
            Добавьте её в Google Calendar, Apple Calendar или Outlook как календарь по ссылке: замены подтянутся сами.
          </p>
          <div className="mt-2 flex gap-2">
            <Button disabled={isBusy} onClick={copyUrl}>
              Скопировать
            </Button>
            <Button variant="ghost" disabled={isBusy} onClick={rotateUrl}>
              Перевыпустить ссылку
            </Button>
          </div>
        </div>

        <div className="border-t border-line pt-3">
          <p className="font-medium">Прямая выгрузка в Google Calendar</p>
          {!feed.data.isGoogleConfigured ? (
            <p className="text-caption text-muted">Google OAuth не настроен на сервере.</p>
          ) : feed.data.isGoogleConnected ? (
            <>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <Field label="С">
                  <Input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
                </Field>
                <Field label="По">
                  <Input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
                </Field>
                <Button variant="primary" disabled={isBusy} onClick={syncGoogle}>
                  Выгрузить
                </Button>
                <Button variant="ghost" disabled={isBusy} onClick={disconnectGoogle}>
                  Отключить
                </Button>
              </div>
              <p className="mt-1 text-caption text-muted">Период — не более 62 дней за одну выгрузку.</p>
            </>
          ) : (
            <Button className="mt-2" disabled={isBusy} onClick={connectGoogle}>
              Подключить Google Calendar
            </Button>
          )}
        </div>
      </div>
    </Section>
  )
}
