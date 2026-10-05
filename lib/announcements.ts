import type { Prisma } from '@prisma/client'
import { userGroupIds } from '@/lib/access'
import { userSummary } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import type { Session } from '@/lib/session-token'
import { groupRoom, roleRoom, userRoom } from '@/lib/socket'
import type { AnnouncementDto, Role } from '@/lib/types'

export const announcementInclude = { author: true, targetGroup: true } as const

type AnnouncementRow = Prisma.AnnouncementGetPayload<{ include: typeof announcementInclude }>

export function serializeAnnouncement(announcement: AnnouncementRow): AnnouncementDto {
  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    author: userSummary(announcement.author),
    targetRole: announcement.targetRole,
    targetGroupId: announcement.targetGroupId,
    targetGroupName: announcement.targetGroup?.name ?? null,
    createdAt: announcement.createdAt.toISOString(),
  }
}

export async function visibleAnnouncementsWhere(session: Session): Promise<Prisma.AnnouncementWhereInput> {
  if (session.role === 'ADMIN') {
    return {}
  }
  const groupIds = await userGroupIds(prisma, session.userId)
  return {
    OR: [
      { authorId: session.userId },
      {
        AND: [
          { OR: [{ targetRole: null }, { targetRole: session.role }] },
          { OR: [{ targetGroupId: null }, { targetGroupId: { in: groupIds } }] },
        ],
      },
    ],
  }
}

type Audience = { targetRole: Role | null; targetGroupId: string | null }

export async function resolveAudience(audience: Audience): Promise<{ userIds: string[]; rooms: string[] }> {
  const { targetRole, targetGroupId } = audience

  if (!targetGroupId) {
    const users = await prisma.user.findMany({
      where: { role: targetRole ?? undefined },
      select: { id: true },
    })
    const roles: Role[] = targetRole ? [targetRole] : ['STUDENT', 'TEACHER', 'ADMIN']
    return { userIds: users.map((user) => user.id), rooms: roles.map(roleRoom) }
  }

  const [students, group, curricula] = await Promise.all([
    prisma.student.findMany({ where: { groupId: targetGroupId, status: 'ACTIVE' }, select: { userId: true } }),
    prisma.group.findUnique({ where: { id: targetGroupId }, include: { curatorTeacher: true } }),
    prisma.curriculum.findMany({ where: { groupId: targetGroupId }, include: { teacher: true } }),
  ])
  const studentUserIds = students.map((student) => student.userId)
  const teacherUserIds = [
    ...curricula.map((curriculum) => curriculum.teacher.userId),
    ...(group?.curatorTeacher ? [group.curatorTeacher.userId] : []),
  ]

  if (targetRole === 'STUDENT') {
    return { userIds: studentUserIds, rooms: studentUserIds.map(userRoom) }
  }
  if (targetRole === 'TEACHER') {
    const uniqueTeacherUserIds = [...new Set(teacherUserIds)]
    return { userIds: uniqueTeacherUserIds, rooms: uniqueTeacherUserIds.map(userRoom) }
  }
  if (targetRole === 'ADMIN') {
    return { userIds: [], rooms: [] }
  }
  return { userIds: [...new Set([...studentUserIds, ...teacherUserIds])], rooms: [groupRoom(targetGroupId)] }
}
