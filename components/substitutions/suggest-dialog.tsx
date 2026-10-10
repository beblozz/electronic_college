'use client'

import { useEffect, useState } from 'react'
import { balanceTone, formatPairBalance } from '@/components/hours/hours-format'
import { reasonLabels, reasons } from '@/components/substitutions/reason-labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Field, Select } from '@/components/ui/field'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { apiFetch, errorText } from '@/lib/client/api'
import { formatDisplayDate } from '@/lib/dates'
import type { AbsenceReason, Lesson, SubstitutionSuggestions } from '@/lib/types'

type SuggestDialogProps = {
  lesson: Lesson
  defaultReason: AbsenceReason
  onClose: () => void
  onAssigned: () => void
}

type Mode = 'same' | 'other' | 'combined'

type Assignment = { substituteTeacherId?: string; subjectId?: string; combinedWithSlotId?: string }

const modeLabels: Record<Mode, string> = {
  same: 'Тот же предмет',
  other: 'Другой предмет',
  combined: 'Совмещение с группой',
}

const emptyTexts: Record<Mode, string> = {
  same: 'Свободных преподавателей по этому предмету нет. Посмотрите вкладки «Другой предмет» и «Совмещение с группой»',
  other: 'Нет свободных преподавателей, которые ведут у этой группы другие предметы',
  combined: 'В это время нет подходящих пар у других групп',
}

function balanceOf(candidate: object): number {
  return 'subjectBalancePairs' in candidate ? Number(candidate.subjectBalancePairs ?? 0) : 0
}

function firstModeWithOptions(suggestions: SubstitutionSuggestions): Mode {
  if (suggestions.candidates.length > 0) {
    return 'same'
  }
  if (suggestions.otherSubjectCandidates.length > 0) {
    return 'other'
  }
  return suggestions.combinedCandidates.length > 0 ? 'combined' : 'same'
}

export function SuggestDialog({ lesson, defaultReason, onClose, onAssigned }: SuggestDialogProps) {
  const [suggestions, setSuggestions] = useState<SubstitutionSuggestions | null>(null)
  const [mode, setMode] = useState<Mode>('same')
  const [reason, setReason] = useState<AbsenceReason>(defaultReason)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    apiFetch<SubstitutionSuggestions>('/api/substitutions/suggest', {
      method: 'POST',
      body: { scheduleSlotId: lesson.scheduleSlotId, date: lesson.date },
    })
      .then((result) => {
        setSuggestions(result)
        setMode(firstModeWithOptions(result))
      })
      .catch((failure) => setError(errorText(failure)))
  }, [lesson.scheduleSlotId, lesson.date])

  const assign = async (assignment: Assignment) => {
    setIsSaving(true)
    try {
      await apiFetch('/api/substitutions', {
        method: 'POST',
        body: { scheduleSlotId: lesson.scheduleSlotId, date: lesson.date, reason, ...assignment },
      })
      onAssigned()
    } catch (failure) {
      setError(errorText(failure))
      setIsSaving(false)
    }
  }

  const counts: Record<Mode, number> = {
    same: suggestions?.candidates.length ?? 0,
    other: suggestions?.otherSubjectCandidates.length ?? 0,
    combined: suggestions?.combinedCandidates.length ?? 0,
  }
  const loadCandidates = mode === 'other' ? suggestions?.otherSubjectCandidates ?? [] : suggestions?.candidates ?? []

  return (
    <Dialog title="Подбор замены" width="wide" onClose={onClose}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-medium">
            {lesson.subject.name} · {lesson.group.name}
          </p>
          <p className="text-caption text-muted">
            {formatDisplayDate(lesson.date)}, {lesson.pairNumber} пара ({lesson.startTime}–{lesson.endTime}), ауд.{' '}
            {lesson.room.number}. Преподаватель: {lesson.teacher.fullName}
          </p>
        </div>
        <Field label="Причина" className="w-36">
          <Select value={reason} onChange={(event) => setReason(event.target.value as AbsenceReason)}>
            {reasons.map((value) => (
              <option key={value} value={value}>
                {reasonLabels[value]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      {!suggestions && !error ? <LoadingState /> : null}

      {suggestions ? (
        <>
          <div className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
            {(Object.keys(modeLabels) as Mode[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`-mb-px whitespace-nowrap border-b-2 px-2.5 py-1.5 transition-colors ${
                  item === mode ? 'border-accent font-medium text-ink' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {modeLabels[item]}
                <span className="ml-1.5 tabular-nums text-muted">{counts[item]}</span>
              </button>
            ))}
          </div>

          {mode !== 'same' && counts[mode] > 0 ? (
            <p className="mb-2 text-caption text-muted">
              Пара по «{lesson.subject.name}» не будет проведена: у предмета появится долг
              {suggestions.slotSubjectBalancePairs !== null && suggestions.slotSubjectBalancePairs !== 0
                ? ` (сейчас ${formatPairBalance(suggestions.slotSubjectBalancePairs)})`
                : ''}
              , а проведённый предмет получит лишнюю пару. Первыми показаны предметы, которые отстают от сетки: так замена
              поможет им догнать программу. Расхождения видны в разделе «Вычитка часов».
            </p>
          ) : null}
          {counts[mode] === 0 ? <EmptyState>{emptyTexts[mode]}</EmptyState> : null}

          {mode !== 'combined' && loadCandidates.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Преподаватель</Th>
                  {mode === 'other' ? <Th>Проведёт предмет</Th> : null}
                  <Th className="text-right">Пар в этот день</Th>
                  <Th className="text-right">Часов в неделю</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {loadCandidates.map((candidate) => {
                  const subject = 'subject' in candidate ? (candidate.subject as { id: string; name: string }) : null
                  return (
                    <tr key={`${candidate.teacherId}:${subject?.id ?? ''}`}>
                      <Td>
                        <p className="font-medium">{candidate.fullName}</p>
                        <p className="text-caption text-muted">{candidate.reason}</p>
                      </Td>
                      {subject ? (
                        <Td>
                          <p>{subject.name}</p>
                          <p className={`text-caption tabular-nums ${balanceTone(balanceOf(candidate))}`}>
                            вычитка: {formatPairBalance(balanceOf(candidate))}
                          </p>
                        </Td>
                      ) : null}
                      <Td className="text-right tabular-nums">{candidate.currentLoadToday}</Td>
                      <Td className="text-right tabular-nums">
                        {candidate.weeklyLoad} из {candidate.maxHoursPerWeek}
                      </Td>
                      <Td className="w-px text-right">
                        <Button
                          size="small"
                          variant="primary"
                          disabled={isSaving}
                          onClick={() => assign({ substituteTeacherId: candidate.teacherId, subjectId: subject?.id })}
                        >
                          Назначить
                        </Button>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          ) : null}

          {mode === 'combined' && suggestions.combinedCandidates.length > 0 ? (
            <Table>
              <thead>
                <tr>
                  <Th>Преподаватель</Th>
                  <Th>Пара, к которой присоединится группа</Th>
                  <Th>Аудитория</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {suggestions.combinedCandidates.map((candidate) => (
                  <tr key={candidate.scheduleSlotId}>
                    <Td className="font-medium">{candidate.fullName}</Td>
                    <Td>
                      <p>
                        {candidate.subject.name} · {candidate.group.name}
                      </p>
                      {candidate.isSameSubject ? <Badge tone="success">тот же предмет</Badge> : null}
                    </Td>
                    <Td>
                      <p className="tabular-nums">
                        {candidate.room.number}: {candidate.studentCount} из {candidate.room.capacity} мест
                      </p>
                      {candidate.fitsRoom ? null : <Badge tone="danger">мест не хватает</Badge>}
                    </Td>
                    <Td className="w-px text-right">
                      <Button
                        size="small"
                        variant="primary"
                        disabled={isSaving}
                        onClick={() => assign({ combinedWithSlotId: candidate.scheduleSlotId })}
                      >
                        Совместить
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </>
      ) : null}
    </Dialog>
  )
}
