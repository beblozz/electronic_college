import { z } from 'zod'
import { uncoveredLessons } from '@/lib/absences'
import { requireTeacher } from '@/lib/auth'
import { formatDisplayDate, parseDate } from '@/lib/dates'
import { badRequest, created, parseBody, route } from '@/lib/http'
import { notifyUsers } from '@/lib/notifications/notify'
import { fullName } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { syncTeacherStatuses } from '@/lib/teacher-status'
import { dateSchema } from '@/lib/validation/common'

const bodySchema = z
  .object({ startDate: dateSchema, endDate: dateSchema })
  .refine((range) => range.startDate <= range.endDate, 'Начало периода позже конца')

export const POST = route(async (request) => {
  const { session, teacher } = await requireTeacher()
  const body = await parseBody(request, bodySchema)
  const startDate = parseDate(body.startDate)
  const endDate = parseDate(body.endDate)

  const overlapping = await prisma.teacherAbsence.findFirst({
    where: { teacherId: teacher.id, startDate: { lte: endDate }, endDate: { gte: startDate } },
  })
  if (overlapping) {
    throw badRequest('На эти даты отсутствие уже отмечено')
  }

  const absence = await prisma.teacherAbsence.create({
    data: { teacherId: teacher.id, reason: 'SICK', startDate, endDate },
  })
  await syncTeacherStatuses(prisma)

  const [affectedLessons, user, admins, refreshedTeacher] = await Promise.all([
    uncoveredLessons(teacher.id, startDate, endDate),
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } }),
    prisma.teacher.findUniqueOrThrow({ where: { id: teacher.id } }),
  ])

  await notifyUsers({
    userIds: admins.map((admin) => admin.id),
    type: 'ABSENCE_REPORTED',
    payload: {
      absenceId: absence.id,
      teacherName: fullName(user),
      startDate: body.startDate,
      endDate: body.endDate,
      lessonCount: affectedLessons.length,
    },
    push: {
      title: 'Преподаватель заболел',
      body: `${fullName(user)}: ${formatDisplayDate(body.startDate)} — ${formatDisplayDate(body.endDate)}, пар без замены: ${affectedLessons.length}`,
      url: '/admin/substitutions',
    },
  })

  return created({
    absenceId: absence.id,
    status: refreshedTeacher.status,
    affectedLessons: affectedLessons.map((lesson) => ({
      scheduleSlotId: lesson.scheduleSlotId,
      date: lesson.date,
      pairNumber: lesson.pairNumber,
      groupName: lesson.group.name,
      subjectName: lesson.subject.name,
    })),
  })
})
