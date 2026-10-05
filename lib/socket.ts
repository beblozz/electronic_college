type EmitInstruction = { rooms: string[]; event: string; payload: unknown }
type JoinInstruction = { userIds: string[]; room: string }

async function postToSocketServer(path: string, body: unknown): Promise<void> {
  const baseUrl = process.env.SOCKET_INTERNAL_URL
  const secret = process.env.SOCKET_INTERNAL_SECRET
  if (!baseUrl || !secret) {
    return
  }
  try {
    await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    })
  } catch (error) {
    console.error('Socket server is unreachable', error)
  }
}

export async function emitToRooms(rooms: string[], event: string, payload: unknown): Promise<void> {
  if (rooms.length === 0) {
    return
  }
  const instruction: EmitInstruction = { rooms, event, payload }
  await postToSocketServer('/internal/emit', instruction)
}

export async function joinUsersToRoom(userIds: string[], room: string): Promise<void> {
  if (userIds.length === 0) {
    return
  }
  const instruction: JoinInstruction = { userIds, room }
  await postToSocketServer('/internal/join', instruction)
}

export const userRoom = (userId: string) => `user:${userId}`
export const groupRoom = (groupId: string) => `group:${groupId}`
export const chatRoom = (chatId: string) => `chat:${chatId}`
export const roleRoom = (role: string) => `role:${role}`
