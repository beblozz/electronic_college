import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { assertChatMember, createMessage, serializeMessage } from '@/lib/chat/chat-service'
import { created, parseBody, route } from '@/lib/http'
import { readPage, toPage } from '@/lib/pagination'
import { prisma } from '@/lib/prisma'
import { chatRoom, emitToRooms } from '@/lib/socket'

type Params = { id: string }

const bodySchema = z.object({ content: z.string().trim().min(1).max(4000) })

export const GET = route<Params>(async (request, { id }) => {
  const session = await requireSession()
  await assertChatMember(id, session.userId)
  const page = readPage(request.nextUrl.searchParams)
  const messages = await prisma.message.findMany({
    where: { chatId: id },
    include: { sender: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...page.args,
  })
  return NextResponse.json(toPage(messages, page.limit, serializeMessage))
})

export const POST = route<Params>(async (request, { id }) => {
  const session = await requireSession()
  const { content } = await parseBody(request, bodySchema)
  const message = await createMessage(id, session.userId, content)
  await emitToRooms([chatRoom(id)], 'message:new', { message })
  return created({ message })
})
