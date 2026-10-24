import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { formatDate, parseDate } from '@/lib/dates'
import { badRequest, notFound } from '@/lib/http'
import { collegeToday } from '@/lib/journal/study-plan'
import { fullName } from '@/lib/people'
import type { DatabaseClient } from '@/lib/prisma'
import { experienceBetween } from '@/lib/staff/experience'
import { syncTeacherStatuses } from '@/lib/teacher-status'
import type { StaffMember } from '@/lib/types'
import { dateSchema } from '@/lib/validation/common'

export const dismissalReasons = ['RETIREMENT', 'OWN_WISH', 'DISMISSED', 'DEATH', 'TRANSFER', 'OTHER'] as const

export const staffProfileSchema = z.object({
  hiredAt: dateSchema.nullable(),
  experienceStartDate: dateSchema.nullable(),
  hasHigherEducation: z.boolean(),
  education: z.string().trim().max(300).nullable(),
})

export const dismissalSchema = z.object({
  date: dateSchema,
  reason: z.enum(dismissalReasons),
  note: z.string().trim().max(300).optional(),
})

const staffInclude = {
  user: true,
  department: true,
  curatedGroups: true,
  _count: { select: { curricula: true, scheduleSlots: { where: { extraDate: null } } } },
} satisfies Prisma.TeacherInclude

type StaffRow = Prisma.TeacherGetPayload<{ include: typeof staffInclude }>

function dateOrNull(value: Date | null): string | null {
  return value ? formatDate(value) : null
}

function serializeStaff(teacher: StaffRow, today: string): StaffMember {
  const endDate = teacher.dismissedAt ? formatDate(teacher.dismissedAt) : today
  const hiredAt = dateOrNull(teacher.hiredAt)
  const experienceStart = dateOrNull(teacher.experienceStartDate) ?? hiredAt
  return {
    id: teacher.id,
    fullName: fullName(teacher.user),
    email: teacher.user.email,
    departmentName: teacher.department.name,
    status: teacher.status,
    hiredAt,
    experienceStartDate: dateOrNull(teacher.experienceStartDate),
    hasHigherEducation: teacher.hasHigherEducation,
    education: teacher.education,
    experience: experienceStart ? experienceBetween(experienceStart, endDate) : null,
    collegeExperience: hiredAt ? experienceBetween(hiredAt, endDate) : null,
    dismissedAt: dateOrNull(teacher.dismissedAt),
    dismissalReason: teacher.dismissalReason,
    dismissalNote: teacher.dismissalNote,
    gridSlotCount: teacher._count.scheduleSlots,
    curriculumCount: teacher._count.curricula,
    curatedGroupNames: teacher.curatedGroups.map((group) => group.name),
  }
}

export async function listStaff(db: DatabaseClient, isArchive: boolean): Promise<StaffMember[]> {
  await syncTeacherStatuses(db)
  const teachers = await db.teacher.findMany({
    where: isArchive ? { status: 'FIRED' } : { status: { not: 'FIRED' } },
    include: staffInclude,
    orderBy: isArchive
      ? [{ dismissedAt: { sort: 'desc', nulls: 'last' } }, { user: { lastName: 'asc' } }]
      : [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
  })
  const today = formatDate(collegeToday())
  return teachers.map((teacher) => serializeStaff(teacher, today))
}

async function findStaff(db: DatabaseClient, id: string): Promise<StaffRow> {
  const teacher = await db.teacher.findUnique({ where: { id }, include: staffInclude })
  if (!teacher) {
    throw notFound('Преподаватель не найден')
  }
  return teacher
}

export async function updateStaffProfile(
  db: DatabaseClient,
  id: string,
  input: z.infer<typeof staffProfileSchema>,
): Promise<StaffMember> {
  await findStaff(db, id)
  if (input.hiredAt && input.experienceStartDate && input.experienceStartDate > input.hiredAt) {
    throw badRequest('Педагогический стаж не может начинаться позже приёма в колледж')
  }
  const today = formatDate(collegeToday())
  if ((input.hiredAt && input.hiredAt > today) || (input.experienceStartDate && input.experienceStartDate > today)) {
    throw badRequest('Дата не может быть в будущем')
  }
  await db.teacher.update({
    where: { id },
    data: {
      hiredAt: input.hiredAt ? parseDate(input.hiredAt) : null,
      experienceStartDate: input.experienceStartDate ? parseDate(input.experienceStartDate) : null,
      hasHigherEducation: input.hasHigherEducation,
      education: input.education || null,
    },
  })
  return serializeStaff(await findStaff(db, id), today)
}

export async function dismissStaff(
  db: DatabaseClient,
  id: string,
  input: z.infer<typeof dismissalSchema>,
): Promise<StaffMember> {
  const teacher = await findStaff(db, id)
  if (teacher.status === 'FIRED') {
    throw badRequest('Преподаватель уже в архиве')
  }
  if (teacher.hiredAt && input.date < formatDate(teacher.hiredAt)) {
    throw badRequest('Дата увольнения раньше даты приёма')
  }
  await db.teacher.update({
    where: { id },
    data: {
      status: 'FIRED',
      dismissedAt: parseDate(input.date),
      dismissalReason: input.reason,
      dismissalNote: input.note || null,
    },
  })
  return serializeStaff(await findStaff(db, id), formatDate(collegeToday()))
}

export async function restoreStaff(db: DatabaseClient, id: string): Promise<StaffMember> {
  const teacher = await findStaff(db, id)
  if (teacher.status !== 'FIRED') {
    throw badRequest('Преподаватель не в архиве')
  }
  await db.teacher.update({
    where: { id },
    data: { status: 'ACTIVE', dismissedAt: null, dismissalReason: null, dismissalNote: null },
  })
  await syncTeacherStatuses(db)
  return serializeStaff(await findStaff(db, id), formatDate(collegeToday()))
}
