import { parseDate, todayInTimeZone } from '@/lib/dates'
import { collegeTimeZone } from '@/lib/env'
import type { DatabaseClient } from '@/lib/prisma'

export async function syncTeacherStatuses(db: DatabaseClient): Promise<void> {
  const today = parseDate(todayInTimeZone(collegeTimeZone()))
  const currentAbsence = { startDate: { lte: today }, endDate: { gte: today } }

  await db.teacher.updateMany({
    where: { status: { in: ['SICK', 'VACATION'] }, absences: { none: currentAbsence } },
    data: { status: 'ACTIVE' },
  })
  await db.teacher.updateMany({
    where: { status: { not: 'FIRED' }, absences: { some: { ...currentAbsence, reason: 'VACATION' } } },
    data: { status: 'VACATION' },
  })
  await db.teacher.updateMany({
    where: { status: { not: 'FIRED' }, absences: { some: { ...currentAbsence, reason: 'SICK' } } },
    data: { status: 'SICK' },
  })
}
