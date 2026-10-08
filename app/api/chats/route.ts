import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { listChats } from '@/lib/chat/chat-service'
import { route } from '@/lib/http'

export const GET = route(async () => {
  const session = await requireSession()
  return NextResponse.json({ chats: await listChats(session.userId) })
})
