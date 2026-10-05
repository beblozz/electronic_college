import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { findOrCreateFeed } from '@/lib/calendar/feed'
import { encryptSecret } from '@/lib/crypto'
import { appUrl } from '@/lib/env'
import { exchangeGoogleCode } from '@/lib/google-oauth'
import { badRequest, noContent, parseBody, route } from '@/lib/http'
import { assertOauthState, clearOauthState } from '@/lib/oauth-state'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({ code: z.string().min(1), state: z.string().min(1) })

export const POST = route(async (request) => {
  const session = await requireSession('STUDENT', 'TEACHER')
  const { code, state } = await parseBody(request, bodySchema)
  await assertOauthState(state)

  const tokens = await exchangeGoogleCode(code, `${appUrl()}/settings/google-callback`)
  if (!tokens.refreshToken) {
    throw badRequest('Google не выдал постоянный доступ, повторите подключение')
  }
  await findOrCreateFeed(session.userId)
  await prisma.calendarFeed.update({
    where: { userId: session.userId },
    data: { googleRefreshToken: encryptSecret(tokens.refreshToken) },
  })

  const response = noContent()
  clearOauthState(response)
  return response
})

export const DELETE = route(async () => {
  const session = await requireSession('STUDENT', 'TEACHER')
  await prisma.calendarFeed.updateMany({
    where: { userId: session.userId },
    data: { googleRefreshToken: null, googleCalendarId: null },
  })
  return noContent()
})
