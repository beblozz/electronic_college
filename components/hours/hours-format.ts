import { formatDisplayDate } from '@/lib/dates'
import type { HoursStatus, SubjectHours } from '@/lib/types'

function pairWord(count: number): string {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'пар'
  }
  if (last === 1) {
    return 'пара'
  }
  return last >= 2 && last <= 4 ? 'пары' : 'пар'
}

export function formatPairBalance(pairs: number): string {
  if (pairs === 0) {
    return '0'
  }
  const sign = pairs > 0 ? '+' : '−'
  return `${sign}${Math.abs(pairs)} ${pairWord(Math.abs(pairs))}`
}

export function formatHourBalance(hours: number): string {
  if (hours === 0) {
    return '0 ч'
  }
  return `${hours > 0 ? '+' : '−'}${Math.abs(hours)} ч`
}

export function balanceTone(value: number): string {
  if (value < 0) {
    return 'text-danger'
  }
  return value > 0 ? 'text-amber-700' : 'text-muted'
}

export const hoursStatusLabels: Record<HoursStatus, string> = {
  AHEAD: 'Опережает',
  BEHIND: 'Долг',
  ON_TRACK: 'По плану',
}

export function completionText(row: SubjectHours): string {
  if (row.remainingPairs === 0 && row.completionDate) {
    return `вычитан ${formatDisplayDate(row.completionDate)}`
  }
  if (row.status === 'BEHIND' || !row.completionDate) {
    return `не успевает: не хватит ${Math.abs(row.forecastBalanceHours)} ч`
  }
  return `закончится ${formatDisplayDate(row.completionDate)}`
}

export function remainingText(row: SubjectHours): string {
  return row.remainingPairs > 0 ? `осталось ${row.remainingPairs} ${pairWord(row.remainingPairs)}` : 'программа вычитана'
}
