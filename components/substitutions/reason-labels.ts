import type { AbsenceReason } from '@/lib/types'

export const reasonLabels: Record<AbsenceReason, string> = {
  SICK: 'Болезнь',
  VACATION: 'Отпуск',
  OTHER: 'Другое',
}

export const reasons = Object.keys(reasonLabels) as AbsenceReason[]
