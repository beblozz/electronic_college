import type { Term } from '@prisma/client'
import { z } from 'zod'
import { daysBetween, formatDate, parseDate } from '@/lib/dates'
import { badRequest } from '@/lib/http'
import type { DatabaseClient } from '@/lib/prisma'
import type { AcademicYear, AcademicTerm } from '@/lib/types'
import { dateSchema } from '@/lib/validation/common'

const rangeSchema = z.object({ startDate: dateSchema, endDate: dateSchema })

export const academicYearSchema = z.object({ first: rangeSchema, second: rangeSchema })

export type AcademicYearInput = z.infer<typeof academicYearSchema>

export function academicYearOf(term: Pick<Term, 'half' | 'startDate'>): number {
  const year = term.startDate.getUTCFullYear()
  return term.half === 1 ? year : year - 1
}

export function termName(half: number, startYear: number): string {
  return `${half} семестр ${startYear}/${startYear + 1}`
}

function serializeTerm(term: Term): AcademicTerm {
  const days = daysBetween(term.startDate, term.endDate) + 1
  return {
    id: term.id,
    name: term.name,
    half: term.half,
    startDate: formatDate(term.startDate),
    endDate: formatDate(term.endDate),
    weeks: Math.ceil(days / 7),
  }
}

export async function listAcademicYears(db: DatabaseClient): Promise<AcademicYear[]> {
  const terms = await db.term.findMany({ orderBy: { startDate: 'asc' } })
  const years = new Map<number, AcademicYear>()
  for (const term of terms) {
    const startYear = academicYearOf(term)
    const entry = years.get(startYear) ?? { startYear, first: null, second: null, breakDays: null }
    if (term.half === 1) {
      entry.first = serializeTerm(term)
    } else {
      entry.second = serializeTerm(term)
    }
    years.set(startYear, entry)
  }
  return [...years.values()]
    .map((year) => ({
      ...year,
      breakDays:
        year.first && year.second
          ? daysBetween(parseDate(year.first.endDate), parseDate(year.second.startDate)) - 1
          : null,
    }))
    .sort((first, second) => first.startYear - second.startYear)
}

function assertRange(label: string, range: { startDate: string; endDate: string }): void {
  if (range.startDate >= range.endDate) {
    throw badRequest(`${label}: начало должно быть раньше конца`)
  }
}

export async function saveAcademicYear(db: DatabaseClient, startYear: number, input: AcademicYearInput): Promise<void> {
  assertRange('1 семестр', input.first)
  assertRange('2 семестр', input.second)
  if (input.first.endDate >= input.second.startDate) {
    throw badRequest('2 семестр должен начинаться после окончания 1 семестра')
  }
  if (parseDate(input.first.startDate).getUTCFullYear() !== startYear) {
    throw badRequest(`1 семестр должен начинаться в ${startYear} году`)
  }

  const existing = await db.term.findMany()
  const ownTerms = existing.filter((term) => academicYearOf(term) === startYear)
  const ranges = [
    { half: 1, ...input.first },
    { half: 2, ...input.second },
  ]
  for (const range of ranges) {
    const own = ownTerms.find((term) => term.half === range.half)
    const overlapping = existing.find(
      (term) =>
        term.id !== own?.id &&
        !ownTerms.some((candidate) => candidate.id === term.id) &&
        formatDate(term.startDate) <= range.endDate &&
        formatDate(term.endDate) >= range.startDate,
    )
    if (overlapping) {
      throw badRequest(`${range.half} семестр пересекается с «${overlapping.name}»`)
    }
  }

  for (const range of ranges) {
    const own = ownTerms.find((term) => term.half === range.half)
    const data = { startDate: parseDate(range.startDate), endDate: parseDate(range.endDate) }
    if (own) {
      await db.term.update({ where: { id: own.id }, data })
    } else {
      await db.term.create({ data: { ...data, half: range.half, name: termName(range.half, startYear) } })
    }
  }
}
