import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { findOrCreatePrivateChat, listChats } from '@/lib/chat/chat-service'
import { parseBody, route } from '@/lib/http'
import { chatRoom, joinUsersToRoom } from '@/lib/socket'
import { idSchema } from '@/lib/validation/common'

export const POST = route(async (request) => {
  const session = await requireSession()
  const { userId } = await parseBody(request, z.object({ userId: idSchema }))
  const chatId = await findOrCreatePrivateChat(session, userId)
  await joinUsersToRoom([session.userId, userId], chatRoom(chatId))
  const chats = await listChats(session.userId)
  return NextResponse.json({ chat: chats.find((chat) => chat.id === chatId) })
})
