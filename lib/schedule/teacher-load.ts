import { addDays, parseDate, startOfWeek } from '@/lib/dates'
import type { DatabaseClient } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'

export const hoursPerPair = 2

export type TeacherPairs = Map<string, Map<string, number[]>>

export async function collectTeacherPairs(
  db: DatabaseClient,
  from: Date,
  to: Date,
  teacherId?: string,
): Promise<TeacherPairs> {
  const lessons = await expandLessons(db, { from, to, filter: teacherId ? { teacherId } : {} })
  const pairsByTeacher: TeacherPairs = new Map()
  for (const lesson of lessons) {
    if (teacherId && lesson.teacher.id !== teacherId) {
      continue
    }
    const pairsByDate = pairsByTeacher.get(lesson.teacher.id) ?? new Map<string, number[]>()
    const pairs = pairsByDate.get(lesson.date) ?? []
    if (!pairs.includes(lesson.pairNumber)) {
      pairs.push(lesson.pairNumber)
      pairs.sort((first, second) => first - second)
    }
    pairsByDate.set(lesson.date, pairs)
    pairsByTeacher.set(lesson.teacher.id, pairsByDate)
  }
  return pairsByTeacher
}

export function weekRange(dateInWeek: string): { weekStart: Date; weekEnd: Date } {
  const weekStart = startOfWeek(parseDate(dateInWeek))
  return { weekStart, weekEnd: addDays(weekStart, 6) }
}

export function countWeeklyPairs(pairsByDate: Map<string, number[]> | undefined): number {
  if (!pairsByDate) {
    return 0
  }
  let total = 0
  for (const pairs of pairsByDate.values()) {
    total += pairs.length
  }
  return total
}

export function findGaps(pairs: number[]): number[] {
  if (pairs.length < 2) {
    return []
  }
  const gaps: number[] = []
  for (let pair = pairs[0] + 1; pair < pairs[pairs.length - 1]; pair += 1) {
    if (!pairs.includes(pair)) {
      gaps.push(pair)
    }
  }
  return gaps
}

export function consecutiveRunLength(pairs: number[], pairNumber: number): number {
  const occupied = new Set([...pairs, pairNumber])
  let length = 1
  for (let pair = pairNumber - 1; occupied.has(pair); pair -= 1) {
    length += 1
  }
  for (let pair = pairNumber + 1; occupied.has(pair); pair += 1) {
    length += 1
  }
  return length
}
