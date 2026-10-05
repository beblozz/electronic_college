import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { addDays, eachDate, formatDate, parseDate } from '@/lib/dates'
import { parseQuery, route } from '@/lib/http'
import { fullName } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { collectTeacherPairs, hoursPerPair } from '@/lib/schedule/teacher-load'
import type { Heatmap } from '@/lib/types'
import { idSchema, weekStartSchema } from '@/lib/validation/common'

const querySchema = z.object({ weekStart: weekStartSchema, departmentId: idSchema.optional() })

export const GET = route(async (request) => {
  await requireSession('ADMIN')
  const { weekStart, departmentId } = parseQuery(request, querySchema)
  const from = parseDate(weekStart)
  const to = addDays(from, 6)
  const days = eachDate(from, to).map(formatDate)

  const [teachers, pairsByTeacher] = await Promise.all([
    prisma.teacher.findMany({
      where: { status: { not: 'FIRED' }, departmentId },
      include: { user: true },
      orderBy: { user: { lastName: 'asc' } },
    }),
    collectTeacherPairs(prisma, from, to),
  ])

  const heatmap: Heatmap = {
    weekStart,
    days,
    teachers: teachers.map((teacher) => {
      const pairsByDate = pairsByTeacher.get(teacher.id)
      const pairsByDay = days.map((day) => pairsByDate?.get(day)?.length ?? 0)
      const weeklyHours = pairsByDay.reduce((total, pairs) => total + pairs, 0) * hoursPerPair
      return {
        teacherId: teacher.id,
        fullName: fullName(teacher.user),
        maxHoursPerWeek: teacher.maxHoursPerWeek,
        weeklyHours,
        isOverloaded: weeklyHours > teacher.maxHoursPerWeek,
        pairsByDay,
      }
    }),
  }
  return NextResponse.json(heatmap)
})
