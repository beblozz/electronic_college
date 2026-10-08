import type { DatabaseClient } from '@/lib/prisma'

async function replaceMembers(db: DatabaseClient, chatId: string, userIds: string[]): Promise<void> {
  await db.chatMember.deleteMany({ where: { chatId, userId: { notIn: userIds } } })
  await db.chatMember.createMany({
    data: userIds.map((userId) => ({ chatId, userId })),
    skipDuplicates: true,
  })
}

async function findOrCreateChat(
  db: DatabaseClient,
  type: 'GROUP' | 'SUBJECT',
  groupId: string,
  subjectId: string | null,
): Promise<string> {
  const existing = await db.chat.findFirst({ where: { type, groupId, subjectId } })
  if (existing) {
    return existing.id
  }
  const chat = await db.chat.create({ data: { type, groupId, subjectId } })
  return chat.id
}

export async function syncGroupChats(db: DatabaseClient, groupId: string): Promise<void> {
  const group = await db.group.findUnique({
    where: { id: groupId },
    include: {
      curatorTeacher: true,
      students: { where: { status: 'ACTIVE' } },
      curricula: { include: { teacher: true } },
    },
  })
  if (!group) {
    return
  }

  const studentUserIds = group.students.map((student) => student.userId)
  const groupChatId = await findOrCreateChat(db, 'GROUP', groupId, null)
  const curatorUserIds = group.curatorTeacher ? [group.curatorTeacher.userId] : []
  await replaceMembers(db, groupChatId, [...studentUserIds, ...curatorUserIds])

  const teacherUserIdsBySubject = new Map<string, Set<string>>()
  for (const curriculum of group.curricula) {
    const teacherUserIds = teacherUserIdsBySubject.get(curriculum.subjectId) ?? new Set<string>()
    teacherUserIds.add(curriculum.teacher.userId)
    teacherUserIdsBySubject.set(curriculum.subjectId, teacherUserIds)
  }

  for (const [subjectId, teacherUserIds] of teacherUserIdsBySubject) {
    const subjectChatId = await findOrCreateChat(db, 'SUBJECT', groupId, subjectId)
    await replaceMembers(db, subjectChatId, [...studentUserIds, ...teacherUserIds])
  }

  await db.chat.deleteMany({
    where: { type: 'SUBJECT', groupId, subjectId: { notIn: [...teacherUserIdsBySubject.keys()] } },
  })
}
