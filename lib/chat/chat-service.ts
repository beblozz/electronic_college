import { teacherGroupIds } from '@/lib/access'
import { forbidden, notFound } from '@/lib/http'
import { fullName, userSummary } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import type { Session } from '@/lib/session-token'
import type { ChatContact, ChatMessage, ChatSummary } from '@/lib/types'

type MessageWithSender = {
  id: string
  chatId: string
  content: string
  createdAt: Date
  readAt: Date | null
  sender: Parameters<typeof userSummary>[0]
}

export function serializeMessage(message: MessageWithSender): ChatMessage {
  return {
    id: message.id,
    chatId: message.chatId,
    sender: userSummary(message.sender),
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    readAt: message.readAt?.toISOString() ?? null,
  }
}

export async function assertChatMember(chatId: string, userId: string): Promise<void> {
  const member = await prisma.chatMember.findUnique({ where: { chatId_userId: { chatId, userId } } })
  if (!member) {
    throw forbidden('Вы не участник этого чата')
  }
}

export async function listChats(userId: string): Promise<ChatSummary[]> {
  const memberships = await prisma.chatMember.findMany({
    where: { userId },
    include: {
      chat: {
        include: {
          group: true,
          subject: true,
          members: { include: { user: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  })

  const summaries = await Promise.all(
    memberships.map(async (membership): Promise<ChatSummary> => {
      const chat = membership.chat
      const unreadCount = await prisma.message.count({
        where: {
          chatId: chat.id,
          senderId: { not: userId },
          createdAt: membership.lastReadAt ? { gt: membership.lastReadAt } : undefined,
        },
      })
      const companion = chat.members.find((member) => member.userId !== userId)
      const titleByType = {
        GROUP: `Группа ${chat.group?.name ?? ''}`.trim(),
        SUBJECT: `${chat.subject?.name ?? 'Предмет'} · ${chat.group?.name ?? ''}`,
        PRIVATE: companion ? fullName(companion.user) : 'Личный чат',
      }
      const lastMessage = chat.messages[0]
      return {
        id: chat.id,
        type: chat.type,
        title: titleByType[chat.type],
        groupId: chat.groupId,
        subjectId: chat.subjectId,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt.toISOString(),
              senderId: lastMessage.senderId,
            }
          : null,
        unreadCount,
      }
    }),
  )

  return summaries.sort((first, second) =>
    (second.lastMessage?.createdAt ?? '').localeCompare(first.lastMessage?.createdAt ?? ''),
  )
}

export async function createMessage(chatId: string, senderId: string, content: string): Promise<ChatMessage> {
  await assertChatMember(chatId, senderId)
  const message = await prisma.message.create({
    data: { chatId, senderId, content: content.trim() },
    include: { sender: true },
  })
  await prisma.chatMember.update({
    where: { chatId_userId: { chatId, userId: senderId } },
    data: { lastReadAt: message.createdAt },
  })
  return serializeMessage(message)
}

export type ReadReceipt = { chatId: string; userId: string; lastMessageId: string; readAt: string }

export async function markChatRead(chatId: string, userId: string, lastMessageId: string): Promise<ReadReceipt> {
  await assertChatMember(chatId, userId)
  const lastMessage = await prisma.message.findFirst({ where: { id: lastMessageId, chatId } })
  if (!lastMessage) {
    throw notFound('Сообщение не найдено')
  }
  const readAt = new Date()
  await prisma.$transaction([
    prisma.chatMember.update({
      where: { chatId_userId: { chatId, userId } },
      data: { lastReadAt: lastMessage.createdAt },
    }),
    prisma.message.updateMany({
      where: { chatId, senderId: { not: userId }, readAt: null, createdAt: { lte: lastMessage.createdAt } },
      data: { readAt },
    }),
  ])
  return { chatId, userId, lastMessageId, readAt: readAt.toISOString() }
}

export async function listContacts(session: Session): Promise<ChatContact[]> {
  if (session.role === 'ADMIN') {
    const users = await prisma.user.findMany({
      where: { id: { not: session.userId } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
    return users.map((user) => ({ ...userSummary(user), caption: user.email }))
  }

  if (session.role === 'STUDENT') {
    const student = await prisma.student.findUnique({ where: { userId: session.userId } })
    if (!student) {
      return []
    }
    const teachers = await prisma.teacher.findMany({
      where: {
        OR: [{ curricula: { some: { groupId: student.groupId } } }, { curatedGroups: { some: { id: student.groupId } } }],
      },
      include: { user: true, curricula: { where: { groupId: student.groupId }, include: { subject: true } } },
      orderBy: { user: { lastName: 'asc' } },
    })
    return teachers.map((teacher) => ({
      ...userSummary(teacher.user),
      caption: [...new Set(teacher.curricula.map((curriculum) => curriculum.subject.name))].join(', ') || 'Куратор',
    }))
  }

  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  if (!teacher) {
    return []
  }
  const groupIds = await teacherGroupIds(prisma, teacher.id)
  const students = await prisma.student.findMany({
    where: { groupId: { in: groupIds }, status: 'ACTIVE' },
    include: { user: true, group: true },
    orderBy: [{ group: { name: 'asc' } }, { user: { lastName: 'asc' } }],
  })
  return students.map((student) => ({ ...userSummary(student.user), caption: student.group.name }))
}

export async function findOrCreatePrivateChat(session: Session, targetUserId: string): Promise<string> {
  if (targetUserId === session.userId) {
    throw forbidden('Нельзя создать чат с самим собой')
  }
  const target = await prisma.user.findUnique({ where: { id: targetUserId } })
  if (!target) {
    throw notFound('Пользователь не найден')
  }
  if (target.role !== 'ADMIN') {
    const contacts = await listContacts(session)
    if (!contacts.some((contact) => contact.id === targetUserId)) {
      throw forbidden('Личный чат доступен только между студентом и его преподавателем')
    }
  }

  const existing = await prisma.chat.findFirst({
    where: {
      type: 'PRIVATE',
      AND: [{ members: { some: { userId: session.userId } } }, { members: { some: { userId: targetUserId } } }],
    },
  })
  if (existing) {
    return existing.id
  }
  const chat = await prisma.chat.create({
    data: { type: 'PRIVATE', members: { create: [{ userId: session.userId }, { userId: targetUserId }] } },
  })
  return chat.id
}
