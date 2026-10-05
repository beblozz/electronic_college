import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTeacher } from '@/lib/auth'
import { addDays, dayOfWeek, eachDate, formatDate, parseDate } from '@/lib/dates'
import { parseQuery, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { collectTeacherPairs, findGaps, hoursPerPair } from '@/lib/schedule/teacher-load'
import type { TeacherLoad } from '@/lib/types'
import { weekStartSchema } from '@/lib/validation/common'

export const GET = route(async (request) => {
  const { teacher } = await requireTeacher()
  const { weekStart } = parseQuery(request, z.object({ weekStart: weekStartSchema }))
  const from = parseDate(weekStart)
  const to = addDays(from, 6)

  const pairsByTeacher = await collectTeacherPairs(prisma, from, to, teacher.id)
  const pairsByDate = pairsByTeacher.get(teacher.id) ?? new Map<string, number[]>()

  const days = eachDate(from, to).map((date) => {
    const pairs = pairsByDate.get(formatDate(date)) ?? []
    return {
      date: formatDate(date),
      dayOfWeek: dayOfWeek(date),
      pairs,
      hours: pairs.length * hoursPerPair,
      gaps: findGaps(pairs),
    }
  })

  const load: TeacherLoad = {
    weekStart,
    maxHoursPerWeek: teacher.maxHoursPerWeek,
    weeklyHours: days.reduce((total, day) => total + day.hours, 0),
    days,
  }
  return NextResponse.json(load)
})
