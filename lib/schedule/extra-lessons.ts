import { z } from 'zod'
import { dayOfWeek, formatDisplayDate, parseDate } from '@/lib/dates'
import { badRequest, conflict, notFound } from '@/lib/http'
import { notifyUsers } from '@/lib/notifications/notify'
import { fullName } from '@/lib/people'
import { prisma, type DatabaseClient } from '@/lib/prisma'
import { emitToRooms, groupRoom, userRoom } from '@/lib/socket'
import { expandLessons, findLesson } from '@/lib/schedule/expand-lessons'
import { timesForPair } from '@/lib/schedule/pair-times'
import { semesterForCourse } from '@/lib/schedule/week-parity'
import type { Lesson, ScheduleConflict } from '@/lib/types'
import { dateSchema, idSchema } from '@/lib/validation/common'

export const extraLessonSchema = z.object({
  groupId: idSchema,
  subjectId: idSchema,
  teacherId: idSchema,
  roomId: idSchema,
  date: dateSchema,
  pairNumber: z.number().int().min(1).max(8),
  reason: z.string().trim().max(200).optional(),
})

export type ExtraLessonInput = z.infer<typeof extraLessonSchema>

export const scheduleChangedEvent = 'schedule:changed'

export async function findExtraLessonConflicts(
  db: DatabaseClient,
  input: Pick<ExtraLessonInput, 'groupId' | 'teacherId' | 'roomId' | 'pairNumber'>,
  date: Date,
): Promise<ScheduleConflict[]> {
  const conflicts: ScheduleConflict[] = []
  const absence = await db.teacherAbsence.findFirst({
    where: { teacherId: input.teacherId, startDate: { lte: date }, endDate: { gte: date } },
    include: { teacher: { include: { user: true } } },
  })
  if (absence) {
    conflicts.push({ kind: 'TEACHER', message: `${fullName(absence.teacher.user)} в этот день отсутствует` })
  }
  const lessons = await expandLessons(db, { from: date, to: date })
  for (const lesson of lessons.filter((candidate) => candidate.pairNumber === input.pairNumber)) {
    if (lesson.teacher.id === input.teacherId) {
      conflicts.push({
        kind: 'TEACHER',
        scheduleSlotId: lesson.scheduleSlotId,
        message: `${lesson.teacher.fullName} в это время ведёт «${lesson.subject.name}» у группы ${lesson.group.name}`,
      })
    }
    if (lesson.room.id === input.roomId) {
      conflicts.push({
        kind: 'ROOM',
        scheduleSlotId: lesson.scheduleSlotId,
        message: `Аудитория ${lesson.room.number} занята группой ${lesson.group.name}`,
      })
    }
    if (lesson.group.id === input.groupId) {
      conflicts.push({
        kind: 'GROUP',
        scheduleSlotId: lesson.scheduleSlotId,
        message: `У группы ${lesson.group.name} в это время «${lesson.subject.name}»`,
      })
    }
  }
  return conflicts
}

async function semesterOnDate(db: DatabaseClient, groupId: string, subjectId: string, date: Date): Promise<number> {
  const [group, term, curriculum] = await Promise.all([
    db.group.findUniqueOrThrow({ where: { id: groupId } }),
    db.term.findFirst({ where: { startDate: { lte: date }, endDate: { gte: date } } }),
    db.curriculum.findFirst({ where: { groupId, subjectId }, orderBy: { semester: 'desc' } }),
  ])
  if (term) {
    return semesterForCourse(group.courseYear, term.half)
  }
  return curriculum?.semester ?? semesterForCourse(group.courseYear, 1)
}

async function announce(lesson: Lesson, teacherUserId: string, isCreated: boolean): Promise<void> {
  const students = await prisma.student.findMany({ where: { groupId: lesson.group.id }, select: { userId: true } })
  await emitToRooms([groupRoom(lesson.group.id), userRoom(teacherUserId)], scheduleChangedEvent, {
    date: lesson.date,
    groupId: lesson.group.id,
  })
  if (!isCreated) {
    return
  }
  const summary = `${formatDisplayDate(lesson.date)}, ${lesson.pairNumber} пара, ${lesson.group.name}: ${lesson.subject.name}, ауд. ${lesson.room.number}`
  await notifyUsers({
    userIds: [teacherUserId, ...students.map((student) => student.userId)],
    type: 'EXTRA_LESSON_CREATED',
    payload: {
      date: lesson.date,
      pairNumber: lesson.pairNumber,
      groupName: lesson.group.name,
      subjectName: lesson.subject.name,
      teacherName: lesson.teacher.fullName,
      roomNumber: lesson.room.number,
    },
    push: { title: 'Дополнительная пара', body: summary, url: '/' },
  })
}

export async function createExtraLesson(input: ExtraLessonInput): Promise<Lesson> {
  const date = parseDate(input.date)
  const slot = await prisma.$transaction(
    async (transaction) => {
      const [qualification, room, group] = await Promise.all([
        transaction.teacherSubject.findUnique({
          where: { teacherId_subjectId: { teacherId: input.teacherId, subjectId: input.subjectId } },
        }),
        transaction.room.findUnique({ where: { id: input.roomId } }),
        transaction.group.findUnique({ where: { id: input.groupId } }),
      ])
      if (!group) {
        throw notFound('Группа не найдена')
      }
      if (!room) {
        throw notFound('Аудитория не найдена')
      }
      if (!qualification) {
        throw badRequest('Преподавателю не назначен этот предмет')
      }
      const conflicts = await findExtraLessonConflicts(transaction, input, date)
      if (conflicts.length > 0) {
        throw conflict('SCHEDULE_CONFLICT', conflicts[0].message, { conflicts })
      }
      return transaction.scheduleSlot.create({
        data: {
          groupId: input.groupId,
          subjectId: input.subjectId,
          teacherId: input.teacherId,
          roomId: input.roomId,
          dayOfWeek: dayOfWeek(date),
          pairNumber: input.pairNumber,
          ...timesForPair(input.pairNumber),
          weekType: 'BOTH',
          semester: await semesterOnDate(transaction, input.groupId, input.subjectId, date),
          extraDate: date,
          extraReason: input.reason || null,
        },
        include: { teacher: true },
      })
    },
    { isolationLevel: 'Serializable' },
  )
  const lesson = await findLesson(prisma, slot.id, date)
  if (!lesson) {
    throw notFound('Пара не найдена')
  }
  await announce(lesson, slot.teacher.userId, true)
  return lesson
}

export async function deleteExtraLesson(id: string): Promise<void> {
  const slot = await prisma.scheduleSlot.findUnique({ where: { id }, include: { teacher: true } })
  if (!slot || !slot.extraDate) {
    throw notFound('Дополнительная пара не найдена')
  }
  const lesson = await findLesson(prisma, slot.id, slot.extraDate)
  await prisma.scheduleSlot.delete({ where: { id } })
  if (lesson) {
    await announce(lesson, slot.teacher.userId, false)
  }
}

export async function listExtraLessons(db: DatabaseClient, from: Date, to: Date): Promise<Lesson[]> {
  return expandLessons(db, { from, to, filter: { onlyExtra: true } })
}
