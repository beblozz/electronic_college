'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { Journal } from '@/lib/types'

export function InsightsPanel({ journal }: { journal: Journal }) {
  const [isOpen, setIsOpen] = useState(true)
  const lagging = journal.students.filter((student) => student.insight.isLagging)
  const attention = journal.students.filter((student) => student.insight.needsAttention)
  const Icon = isOpen ? ChevronDown : ChevronRight

  return (
    <section className="mb-4 rounded border border-line">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-subtle"
      >
        <Icon size={16} strokeWidth={1.5} className="text-muted" />
        <span className="font-medium">Помощник по успеваемости</span>
        <span className="text-caption text-muted">
          отстают: {lagging.length}, мало оценок: {attention.length}. Средний балл группы:{' '}
          {journal.stats.averageGrade?.toFixed(2) ?? '—'}, оценок у студента обычно {journal.stats.medianGradeCount}
        </span>
      </button>
      {isOpen ? (
        <div className="grid gap-4 border-t border-line px-3 py-2 md:grid-cols-2">
          <div>
            <p className="mb-1 text-caption font-medium text-danger">Отстающие</p>
            {lagging.length === 0 ? <p className="text-caption text-muted">Нет</p> : null}
            {lagging.map((student) => (
              <p key={student.studentId} className="text-body">
                <span className="font-medium">{student.fullName}</span>
                <span className="text-muted"> — {student.insight.reasons.join('; ')}</span>
              </p>
            ))}
          </div>
          <div>
            <p className="mb-1 text-caption font-medium text-amber-700">Мало оценок по сравнению с группой</p>
            {attention.length === 0 ? <p className="text-caption text-muted">Нет</p> : null}
            {attention.map((student) => (
              <p key={student.studentId} className="text-body">
                <span className="font-medium">{student.fullName}</span>
                <span className="text-muted"> — {student.insight.reasons.join('; ')}. Стоит спросить на ближайшей паре</span>
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
