import { NextResponse } from 'next/server'
import { z } from 'zod'
import { teacherCanMarkLesson } from '@/lib/access'
import { requireSession } from '@/lib/auth'
import { parseDate } from '@/lib/dates'
import { badRequest, forbidden, notFound, parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { findLesson } from '@/lib/schedule/expand-lessons'
import { dateSchema, idSchema } from '@/lib/validation/common'

const bodySchema = z.object({
  scheduleSlotId: idSchema,
  date: dateSchema,
  records: z
    .array(z.object({ studentId: idSchema, status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']) }))
    .min(1)
    .max(100),
})

export const POST = route(async (request) => {
  const session = await requireSession('TEACHER', 'ADMIN')
  const body = await parseBody(request, bodySchema)
  const date = parseDate(body.date)

  const slot = await prisma.scheduleSlot.findUnique({ where: { id: body.scheduleSlotId } })
  if (!slot) {
    throw notFound('Пара не найдена')
  }
  const lesson = await findLesson(prisma, slot.id, date)
  if (!lesson) {
    throw badRequest('В эту дату пара не проводится')
  }

  let markedByTeacherId = lesson.teacher.id
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher || !(await teacherCanMarkLesson(prisma, teacher.id, slot, date))) {
      throw forbidden('Вы не ведёте эту пару')
    }
    markedByTeacherId = teacher.id
  }

  const studentIds = body.records.map((record) => record.studentId)
  const groupStudentCount = await prisma.student.count({ where: { id: { in: studentIds }, groupId: slot.groupId } })
  if (groupStudentCount !== new Set(studentIds).size) {
    throw badRequest('В списке есть студенты из другой группы')
  }

  await prisma.$transaction(
    body.records.map((record) =>
      prisma.attendance.upsert({
        where: {
          studentId_scheduleSlotId_date: { studentId: record.studentId, scheduleSlotId: slot.id, date },
        },
        create: { studentId: record.studentId, scheduleSlotId: slot.id, date, status: record.status, markedByTeacherId },
        update: { status: record.status, markedByTeacherId },
      }),
    ),
  )
  return NextResponse.json({ saved: body.records.length })
})
