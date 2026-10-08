import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { listContacts } from '@/lib/chat/chat-service'
import { route } from '@/lib/http'

export const GET = route(async () => {
  const session = await requireSession()
  return NextResponse.json({ contacts: await listContacts(session) })
})
