'use client'

import { useState } from 'react'
import { TemplateEditor } from '@/components/schedule/template-editor'
import { WeekBrowser } from '@/components/schedule/week-browser'
import { PageHeader } from '@/components/ui/page-header'

type Mode = 'template' | 'week'

const modes: Array<{ mode: Mode; label: string }> = [
  { mode: 'template', label: 'Сетка расписания' },
  { mode: 'week', label: 'Неделя с заменами' },
]

export default function AdminSchedulePage() {
  const [mode, setMode] = useState<Mode>('template')

  return (
    <>
      <PageHeader title="Расписание" />
      <div className="mb-3 flex gap-1 border-b border-line">
        {modes.map((item) => (
          <button
            key={item.mode}
            type="button"
            onClick={() => setMode(item.mode)}
            className={`-mb-px border-b-2 px-2.5 py-1.5 transition-colors ${
              item.mode === mode ? 'border-accent font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {mode === 'template' ? <TemplateEditor /> : <WeekBrowser />}
    </>
  )
}
