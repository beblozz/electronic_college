import type { DatabaseClient } from '@/lib/prisma'

export async function teacherTeachesSubject(
  db: DatabaseClient,
  teacherId: string,
  groupId: string,
  subjectId: string,
  date?: Date,
): Promise<boolean> {
  const [curriculum, ownSlot] = await Promise.all([
    db.curriculum.findFirst({ where: { teacherId, groupId, subjectId } }),
    db.scheduleSlot.findFirst({ where: { teacherId, groupId, subjectId } }),
  ])
  if (curriculum || ownSlot) {
    return true
  }
  if (!date) {
    return false
  }
  const substitution = await db.substitution.findFirst({
    where: { substituteTeacherId: teacherId, date, ...substitutedSubjectWhere(groupId, subjectId) },
  })
  return substitution !== null
}

function substitutedSubjectWhere(groupId: string, subjectId: string) {
  return {
    OR: [
      { subjectId: null, scheduleSlot: { groupId, subjectId } },
      { subjectId, scheduleSlot: { groupId } },
    ],
  }
}

export async function teacherCanViewJournal(
  db: DatabaseClient,
  teacherId: string,
  groupId: string,
  subjectId: string,
): Promise<boolean> {
  if (await teacherTeachesSubject(db, teacherId, groupId, subjectId)) {
    return true
  }
  const curatedGroup = await db.group.findFirst({ where: { id: groupId, curatorTeacherId: teacherId } })
  if (curatedGroup) {
    return true
  }
  const substitution = await db.substitution.findFirst({
    where: { substituteTeacherId: teacherId, ...substitutedSubjectWhere(groupId, subjectId) },
  })
  return substitution !== null
}

export async function teacherCanMarkLesson(
  db: DatabaseClient,
  teacherId: string,
  slot: { id: string; teacherId: string },
  date: Date,
): Promise<boolean> {
  const substitution = await db.substitution.findUnique({
    where: { date_scheduleSlotId: { date, scheduleSlotId: slot.id } },
  })
  if (substitution) {
    return substitution.substituteTeacherId === teacherId
  }
  return slot.teacherId === teacherId
}

export async function teacherGroupIds(db: DatabaseClient, teacherId: string): Promise<string[]> {
  const [curricula, slots, curatedGroups] = await Promise.all([
    db.curriculum.findMany({ where: { teacherId }, select: { groupId: true }, distinct: ['groupId'] }),
    db.scheduleSlot.findMany({ where: { teacherId }, select: { groupId: true }, distinct: ['groupId'] }),
    db.group.findMany({ where: { curatorTeacherId: teacherId }, select: { id: true } }),
  ])
  return [
    ...new Set([
      ...curricula.map((item) => item.groupId),
      ...slots.map((slot) => slot.groupId),
      ...curatedGroups.map((group) => group.id),
    ]),
  ]
}

export async function userGroupIds(db: DatabaseClient, userId: string): Promise<string[]> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { student: true, teacher: true } })
  if (user?.student) {
    return [user.student.groupId]
  }
  if (user?.teacher) {
    return teacherGroupIds(db, user.teacher.id)
  }
  return []
}
