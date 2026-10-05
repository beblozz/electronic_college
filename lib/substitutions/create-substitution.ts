import { formatDate, formatDisplayDate } from '@/lib/dates'
import { badRequest, conflict, notFound } from '@/lib/http'
import { notifyUsers } from '@/lib/notifications/notify'
import { DatabaseClient, prisma } from '@/lib/prisma'
import { findSubstitutionConflicts } from '@/lib/schedule/conflicts'
import { findLesson } from '@/lib/schedule/expand-lessons'
import { emitToRooms, groupRoom, userRoom } from '@/lib/socket'
import type { AbsenceReason, Lesson, ScheduleConflict, SubstitutionKind } from '@/lib/types'

type CreateOptions = {
  scheduleSlotId: string
  date: Date
  substituteTeacherId?: string
  subjectId?: string
  combinedWithSlotId?: string
  reason: AbsenceReason
  adminUserId: string
}

type Assignment = {
  kind: SubstitutionKind
  teacherId: string
  subjectId: string
  roomId: string | null
  combinedWithSlotId: string | null
}

async function resolveAssignment(
  db: DatabaseClient,
  slot: { subjectId: string; pairNumber: number; groupId: string },
  options: CreateOptions,
): Promise<Assignment> {
  if (options.combinedWithSlotId) {
    const joinedLesson = await findLesson(db, options.combinedWithSlotId, options.date)
    if (!joinedLesson || joinedLesson.pairNumber !== slot.pairNumber || joinedLesson.group.id === slot.groupId) {
      throw badRequest('Для совмещения нужна пара другой группы в это же время')
    }
    return {
      kind: 'COMBINED',
      teacherId: joinedLesson.teacher.id,
      subjectId: joinedLesson.subject.id,
      roomId: joinedLesson.room.id,
      combinedWithSlotId: options.combinedWithSlotId,
    }
  }
  if (!options.substituteTeacherId) {
    throw badRequest('Выберите преподавателя')
  }
  const subjectId = options.subjectId ?? slot.subjectId
  return {
    kind: subjectId === slot.subjectId ? 'SAME_SUBJECT' : 'OTHER_SUBJECT',
    teacherId: options.substituteTeacherId,
    subjectId,
    roomId: null,
    combinedWithSlotId: null,
  }
}

export async function createSubstitution(options: CreateOptions) {
  const { scheduleSlotId, date, reason, adminUserId } = options

  const substitution = await prisma.$transaction(
    async (transaction) => {
      const slot = await transaction.scheduleSlot.findUnique({ where: { id: scheduleSlotId } })
      if (!slot) {
        throw notFound('Пара не найдена')
      }
      if (!(await findLesson(transaction, scheduleSlotId, date))) {
        throw badRequest('В эту дату пара не проводится')
      }
      const assignment = await resolveAssignment(transaction, slot, options)
      if (slot.teacherId === assignment.teacherId) {
        throw badRequest('Преподаватель уже ведёт эту пару')
      }
      const substitute = await transaction.teacher.findFirst({
        where: {
          id: assignment.teacherId,
          status: { not: 'FIRED' },
          teacherSubjects: { some: { subjectId: assignment.subjectId } },
        },
        include: { absences: { where: { startDate: { lte: date }, endDate: { gte: date } } } },
      })
      if (!substitute) {
        throw badRequest('Преподаватель не может вести этот предмет')
      }

      const conflicts: ScheduleConflict[] = await findSubstitutionConflicts(
        transaction,
        slot,
        date,
        assignment.teacherId,
        assignment.combinedWithSlotId,
      )
      if (substitute.absences.length > 0) {
        conflicts.unshift({ kind: 'TEACHER', message: 'Преподаватель отсутствует в эту дату' })
      }
      if (conflicts.length > 0) {
        throw conflict('SCHEDULE_CONFLICT', conflicts[0].message, { conflicts })
      }

      return transaction.substitution.create({
        data: {
          scheduleSlotId,
          date,
          originalTeacherId: slot.teacherId,
          substituteTeacherId: assignment.teacherId,
          kind: assignment.kind,
          subjectId: assignment.subjectId === slot.subjectId ? null : assignment.subjectId,
          roomId: assignment.roomId,
          combinedWithSlotId: assignment.combinedWithSlotId,
          reason,
          createdByAdminId: adminUserId,
        },
      })
    },
    { isolationLevel: 'Serializable' },
  )

  const lesson = await findLesson(prisma, scheduleSlotId, date)
  if (lesson) {
    await announceSubstitution(substitution.id, substitution.reason, lesson, [
      substitution.originalTeacherId,
      substitution.substituteTeacherId,
    ])
  }

  return {
    id: substitution.id,
    scheduleSlotId: substitution.scheduleSlotId,
    date: formatDate(substitution.date),
    originalTeacherId: substitution.originalTeacherId,
    substituteTeacherId: substitution.substituteTeacherId,
    kind: substitution.kind,
    subjectId: substitution.subjectId,
    combinedWithSlotId: substitution.combinedWithSlotId,
    reason: substitution.reason,
    createdByAdminId: substitution.createdByAdminId,
    createdAt: substitution.createdAt.toISOString(),
  }
}

async function announceSubstitution(
  substitutionId: string,
  reason: AbsenceReason,
  lesson: Lesson,
  teacherIds: string[],
): Promise<void> {
  const [teachers, students] = await Promise.all([
    prisma.teacher.findMany({ where: { id: { in: teacherIds } }, select: { userId: true } }),
    prisma.student.findMany({ where: { groupId: lesson.group.id, status: 'ACTIVE' }, select: { userId: true } }),
  ])
  const teacherUserIds = teachers.map((teacher) => teacher.userId)

  await emitToRooms([groupRoom(lesson.group.id), ...teacherUserIds.map(userRoom)], 'substitution:created', {
    substitution: { id: substitutionId, date: lesson.date, reason },
    lesson,
  })

  await notifyUsers({
    userIds: [...students.map((student) => student.userId), ...teacherUserIds],
    type: 'SUBSTITUTION_CREATED',
    payload: {
      substitutionId,
      date: lesson.date,
      pairNumber: lesson.pairNumber,
      subjectName: lesson.subject.name,
      groupName: lesson.group.name,
      substituteTeacherName: lesson.teacher.fullName,
    },
    push: {
      title: 'Замена в расписании',
      body: `${formatDisplayDate(lesson.date)}, ${lesson.pairNumber} пара: ${lesson.subject.name} — ${lesson.teacher.fullName}`,
      url: '/notifications',
    },
  })
}
