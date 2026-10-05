import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { badRequest, conflict } from '@/lib/http'
import { fullName } from '@/lib/people'
import type { DatabaseClient } from '@/lib/prisma'
import { findSlotConflicts } from '@/lib/schedule/conflicts'
import type { ScheduleSlotDto, ScheduleSlotView } from '@/lib/types'
import { idSchema, timeSchema } from '@/lib/validation/common'

export const slotSchema = z.object({
  groupId: idSchema,
  subjectId: idSchema,
  teacherId: idSchema,
  roomId: idSchema,
  dayOfWeek: z.number().int().min(1).max(7),
  pairNumber: z.number().int().min(1).max(8),
  startTime: timeSchema,
  endTime: timeSchema,
  weekType: z.enum(['ODD', 'EVEN', 'BOTH']),
  semester: z.number().int().min(1).max(12),
})

export type SlotInput = z.infer<typeof slotSchema>

export const slotViewInclude = {
  group: true,
  subject: true,
  room: true,
  teacher: { include: { user: true } },
} as const

type SlotRow = Prisma.ScheduleSlotGetPayload<{ include: typeof slotViewInclude }>

export function serializeSlot(slot: ScheduleSlotDto): ScheduleSlotDto {
  return {
    id: slot.id,
    groupId: slot.groupId,
    subjectId: slot.subjectId,
    teacherId: slot.teacherId,
    roomId: slot.roomId,
    dayOfWeek: slot.dayOfWeek,
    pairNumber: slot.pairNumber,
    startTime: slot.startTime,
    endTime: slot.endTime,
    weekType: slot.weekType,
    semester: slot.semester,
  }
}

export function serializeSlotView(slot: SlotRow): ScheduleSlotView {
  return {
    ...serializeSlot(slot),
    groupName: slot.group.name,
    subjectName: slot.subject.name,
    teacherName: fullName(slot.teacher.user),
    roomLabel: `${slot.room.number}, ${slot.room.building}`,
  }
}

export async function assertSlotIsValid(db: DatabaseClient, slot: SlotInput, excludedSlotId?: string): Promise<void> {
  if (slot.startTime >= slot.endTime) {
    throw badRequest('Начало пары позже конца')
  }
  const qualification = await db.teacherSubject.findUnique({
    where: { teacherId_subjectId: { teacherId: slot.teacherId, subjectId: slot.subjectId } },
  })
  if (!qualification) {
    throw badRequest('Преподавателю не назначен этот предмет')
  }
  const conflicts = await findSlotConflicts(db, slot, excludedSlotId)
  if (conflicts.length > 0) {
    throw conflict('SCHEDULE_CONFLICT', conflicts[0].message, { conflicts })
  }
}
