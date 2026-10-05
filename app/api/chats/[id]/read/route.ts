import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { markChatRead } from '@/lib/chat/chat-service'
import { noContent, parseBody, route } from '@/lib/http'
import { chatRoom, emitToRooms } from '@/lib/socket'
import { idSchema } from '@/lib/validation/common'

type Params = { id: string }

export const POST = route<Params>(async (request, { id }) => {
  const session = await requireSession()
  const { lastMessageId } = await parseBody(request, z.object({ lastMessageId: idSchema }))
  const receipt = await markChatRead(id, session.userId, lastMessageId)
  await emitToRooms([chatRoom(id)], 'message:read', receipt)
  return noContent()
})
