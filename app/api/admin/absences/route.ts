import { NextResponse } from 'next/server'
import { z } from 'zod'
import { listAbsences } from '@/lib/absences'
import { requireSession } from '@/lib/auth'
import { formatDate, parseDate } from '@/lib/dates'
import { badRequest, created, parseBody, parseQuery, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { syncTeacherStatuses } from '@/lib/teacher-status'
import { dateRangeSchema, dateSchema, idSchema } from '@/lib/validation/common'

const bodySchema = z
  .object({
    teacherId: idSchema,
    reason: z.enum(['SICK', 'VACATION', 'OTHER']),
    startDate: dateSchema,
    endDate: dateSchema,
  })
  .refine((absence) => absence.startDate <= absence.endDate, 'Начало периода позже конца')

export const GET = route(async (request) => {
  await requireSession('ADMIN')
  const { from, to } = parseQuery(request, dateRangeSchema)
  await syncTeacherStatuses(prisma)
  return NextResponse.json({ absences: await listAbsences(parseDate(from), parseDate(to)) })
})

export const POST = route(async (request) => {
  await requireSession('ADMIN')
  const body = await parseBody(request, bodySchema)
  const startDate = parseDate(body.startDate)
  const endDate = parseDate(body.endDate)

  const overlapping = await prisma.teacherAbsence.findFirst({
    where: { teacherId: body.teacherId, startDate: { lte: endDate }, endDate: { gte: startDate } },
  })
  if (overlapping) {
    throw badRequest('На эти даты отсутствие уже отмечено')
  }
  const absence = await prisma.teacherAbsence.create({
    data: { teacherId: body.teacherId, reason: body.reason, startDate, endDate },
  })
  await syncTeacherStatuses(prisma)
  return created({
    absence: {
      id: absence.id,
      teacherId: absence.teacherId,
      reason: absence.reason,
      startDate: formatDate(absence.startDate),
      endDate: formatDate(absence.endDate),
    },
  })
})
