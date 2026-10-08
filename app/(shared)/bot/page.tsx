'use client'

import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { ErrorState } from '@/components/ui/states'
import { apiFetch, errorText } from '@/lib/client/api'
import type { BotAnswer } from '@/lib/types'

type Exchange = { id: number; question: string; answer: BotAnswer | null }

export default function BotPage() {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [question, setQuestion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isWaiting, setIsWaiting] = useState(false)

  const ask = async (event: FormEvent) => {
    event.preventDefault()
    const text = question.trim()
    if (!text) {
      return
    }
    const exchangeId = Date.now()
    setExchanges((current) => [...current, { id: exchangeId, question: text, answer: null }])
    setQuestion('')
    setIsWaiting(true)
    try {
      const answer = await apiFetch<BotAnswer>('/api/bot/ask', { method: 'POST', body: { question: text } })
      setExchanges((current) => current.map((item) => (item.id === exchangeId ? { ...item, answer } : item)))
      setError(null)
    } catch (failure) {
      setExchanges((current) => current.filter((item) => item.id !== exchangeId))
      setQuestion(text)
      setError(errorText(failure))
    } finally {
      setIsWaiting(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Помощник" caption="Отвечает по документам колледжа: правилам, положениям, регламентам" />

      <div className="flex flex-col gap-4">
        {exchanges.map((exchange) => (
          <div key={exchange.id} className="rounded border border-line">
            <p className="border-b border-line bg-subtle px-3 py-2 font-medium">{exchange.question}</p>
            <div className="px-3 py-2">
              {exchange.answer ? (
                <>
                  <p className="whitespace-pre-wrap">{exchange.answer.answer}</p>
                  {exchange.answer.sources.length > 0 ? (
                    <div className="mt-2 border-t border-line pt-2">
                      <p className="text-caption text-muted">Источники</p>
                      {exchange.answer.sources.map((source) => (
                        <p key={source.documentId} className="text-caption">
                          <span className="font-medium">{source.title}</span>
                          <span className="text-muted"> — {source.excerpt}…</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-muted">Ищу ответ в документах…</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {error ? (
        <div className="mt-3">
          <ErrorState message={error} />
        </div>
      ) : null}

      <form onSubmit={ask} className="mt-4 flex gap-2">
        <Input
          value={question}
          maxLength={1000}
          placeholder="Например: сколько пропусков допускается без справки?"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button type="submit" variant="primary" disabled={isWaiting || question.trim().length === 0}>
          Спросить
        </Button>
      </form>
    </div>
  )
}
