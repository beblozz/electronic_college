import './load-env'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { Server, Socket } from 'socket.io'
import { z } from 'zod'
import { userGroupIds } from '@/lib/access'
import { createMessage, markChatRead } from '@/lib/chat/chat-service'
import { appUrl, requireEnv } from '@/lib/env'
import { ApiError } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { Session, sessionCookieName, verifySessionToken } from '@/lib/session-token'
import { chatRoom, groupRoom, roleRoom, userRoom } from '@/lib/socket'

type Acknowledge = (response: { ok: true; [key: string]: unknown } | { ok: false; error: string }) => void
type SocketData = { session: Session }
type AuthenticatedSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>

const port = Number(process.env.SOCKET_PORT ?? 3001)
const internalSecret = requireEnv('SOCKET_INTERNAL_SECRET')

const sendMessageSchema = z.object({ chatId: z.string().min(1), content: z.string().trim().min(1).max(4000) })
const readMessageSchema = z.object({ chatId: z.string().min(1), lastMessageId: z.string().min(1) })
const typingSchema = z.object({ chatId: z.string().min(1) })
const emitSchema = z.object({ rooms: z.array(z.string()).min(1), event: z.string().min(1), payload: z.unknown() })
const joinSchema = z.object({ userIds: z.array(z.string()).min(1), room: z.string().min(1) })

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined
  }
  for (const part of header.split(';')) {
    const [key, ...valueParts] = part.trim().split('=')
    if (key === name) {
      return decodeURIComponent(valueParts.join('='))
    }
  }
  return undefined
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function respond(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof z.ZodError) {
    return 'Некорректные данные'
  }
  console.error(error)
  return 'Внутренняя ошибка сервера'
}

const httpServer = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    respond(response, 200, { ok: true })
    return
  }
  const isInternalCall = request.method === 'POST' && request.url?.startsWith('/internal/')
  if (!isInternalCall) {
    respond(response, 404, { ok: false })
    return
  }
  if (request.headers['x-internal-secret'] !== internalSecret) {
    respond(response, 403, { ok: false })
    return
  }
  try {
    const body = await readJsonBody(request)
    if (request.url === '/internal/emit') {
      const { rooms, event, payload } = emitSchema.parse(body)
      io.to(rooms).emit(event, payload)
    } else if (request.url === '/internal/join') {
      const { userIds, room } = joinSchema.parse(body)
      io.in(userIds.map(userRoom)).socketsJoin(room)
    } else {
      respond(response, 404, { ok: false })
      return
    }
    respond(response, 200, { ok: true })
  } catch (error) {
    respond(response, 400, { ok: false, error: errorMessage(error) })
  }
})

const io = new Server(httpServer, {
  cors: { origin: appUrl(), credentials: true },
})

io.use(async (socket, next) => {
  const token = readCookie(socket.handshake.headers.cookie, sessionCookieName)
  const session = await verifySessionToken(token)
  if (!session) {
    next(new Error('UNAUTHENTICATED'))
    return
  }
  socket.data.session = session
  next()
})

async function joinPersonalRooms(socket: AuthenticatedSocket): Promise<void> {
  const { userId, role } = socket.data.session
  const [groupIds, memberships] = await Promise.all([
    userGroupIds(prisma, userId),
    prisma.chatMember.findMany({ where: { userId }, select: { chatId: true } }),
  ])
  await socket.join([
    userRoom(userId),
    roleRoom(role),
    ...groupIds.map(groupRoom),
    ...memberships.map((membership) => chatRoom(membership.chatId)),
  ])
}

io.on('connection', (rawSocket) => {
  const socket = rawSocket as unknown as AuthenticatedSocket
  const { userId } = socket.data.session
  const roomsReady = joinPersonalRooms(socket).catch((error) => {
    console.error(error)
    socket.disconnect(true)
  })

  rawSocket.on('message:send', async (input: unknown, acknowledge?: Acknowledge) => {
    try {
      await roomsReady
      const { chatId, content } = sendMessageSchema.parse(input)
      const message = await createMessage(chatId, userId, content)
      io.to(chatRoom(chatId)).emit('message:new', { message })
      acknowledge?.({ ok: true, message })
    } catch (error) {
      acknowledge?.({ ok: false, error: errorMessage(error) })
    }
  })

  rawSocket.on('message:read', async (input: unknown, acknowledge?: Acknowledge) => {
    try {
      await roomsReady
      const { chatId, lastMessageId } = readMessageSchema.parse(input)
      const receipt = await markChatRead(chatId, userId, lastMessageId)
      io.to(chatRoom(chatId)).emit('message:read', receipt)
      acknowledge?.({ ok: true })
    } catch (error) {
      acknowledge?.({ ok: false, error: errorMessage(error) })
    }
  })

  for (const event of ['typing:start', 'typing:stop'] as const) {
    rawSocket.on(event, async (input: unknown) => {
      await roomsReady
      const parsed = typingSchema.safeParse(input)
      if (parsed.success && rawSocket.rooms.has(chatRoom(parsed.data.chatId))) {
        rawSocket.to(chatRoom(parsed.data.chatId)).emit(event, { chatId: parsed.data.chatId, userId })
      }
    })
  }
})

httpServer.listen(port, () => {
  console.log(`Socket server is listening on port ${port}`)
})
