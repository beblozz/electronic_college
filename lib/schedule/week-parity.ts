import { daysBetween, startOfWeek } from '@/lib/dates'
import type { WeekType } from '@/lib/types'

export function weekTypeForDate(termStart: Date, date: Date): Exclude<WeekType, 'BOTH'> {
  const weekIndex = Math.floor(daysBetween(startOfWeek(termStart), startOfWeek(date)) / 7)
  return weekIndex % 2 === 0 ? 'ODD' : 'EVEN'
}

export function weekTypesOverlap(first: WeekType, second: WeekType): boolean {
  return first === 'BOTH' || second === 'BOTH' || first === second
}

export function semesterForCourse(courseYear: number, termHalf: number): number {
  return (courseYear - 1) * 2 + termHalf
}
