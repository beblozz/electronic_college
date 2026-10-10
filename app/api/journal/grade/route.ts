import { z } from 'zod'
import { formatDate, formatDisplayDate, parseDate } from '@/lib/dates'
import { created, notFound, parseBody, route } from '@/lib/http'
import { resolveGradingTeacherId } from '@/lib/journal/grade-access'
import { gradeInclude, serializeGrade } from '@/lib/journal/journal-service'
import { resolvePlanItem } from '@/lib/journal/plan-item'
import { notifyUsers } from '@/lib/notifications/notify'
import { teacherRef } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { emitToRooms, userRoom } from '@/lib/socket'
import { dateSchema, idSchema } from '@/lib/validation/common'

const gradeKindForPlanItem = { LECTURE: 'LECTURE', PRACTICAL: 'PRACTICAL' } as const

const bodySchema = z.object({
  studentId: idSchema,
  subjectId: idSchema,
  value: z.number().int().min(2).max(5),
  date: dateSchema,
  comment: z.string().trim().max(500).optional(),
  kind: z.enum(['ANSWER', 'SURVEY', 'PRACTICAL', 'LECTURE', 'TEST']).optional(),
  planItemId: idSchema.nullish(),
})

export const POST = route(async (request) => {
  const body = await parseBody(request, bodySchema)
  const student = await prisma.student.findUnique({ where: { id: body.studentId } })
  if (!student) {
    throw notFound('Студент не найден')
  }
  const date = parseDate(body.date)
  const teacherId = await resolveGradingTeacherId(student.groupId, body.subjectId, date)
  const planItem = await resolvePlanItem(body.planItemId, student.groupId, body.subjectId, date)
  const kind = body.kind ?? (planItem ? gradeKindForPlanItem[planItem.kind] : 'ANSWER')

  const grade = await prisma.grade.create({
    data: {
      studentId: student.id,
      subjectId: body.subjectId,
      teacherId,
      value: body.value,
      date,
      comment: body.comment || null,
      kind,
      planItemId: planItem?.id ?? null,
    },
    include: { subject: true, ...gradeInclude },
  })

  await emitToRooms([userRoom(student.userId)], 'grade:created', {
    grade: serializeGrade(grade),
    subject: { id: grade.subject.id, name: grade.subject.name },
    teacher: teacherRef(grade.teacher),
  })
  await notifyUsers({
    userIds: [student.userId],
    type: 'GRADE_CREATED',
    payload: { gradeId: grade.id, subjectName: grade.subject.name, value: grade.value, date: formatDate(grade.date) },
    push: {
      title: 'Новая оценка',
      body: `${grade.subject.name}: ${grade.value} за ${formatDisplayDate(body.date)}`,
      url: '/student/grades',
    },
  })

  return created({
    grade: {
      ...serializeGrade(grade),
      studentId: grade.studentId,
      subjectId: grade.subjectId,
      teacherId: grade.teacherId,
    },
  })
})
