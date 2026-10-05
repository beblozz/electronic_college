import { NextResponse } from 'next/server'
import { z } from 'zod'
import { attachSessionCookie, loadSessionUser } from '@/lib/auth'
import { appUrl } from '@/lib/env'
import { exchangeGoogleCode, fetchGoogleProfile } from '@/lib/google-oauth'
import { forbidden, parseBody, route } from '@/lib/http'
import { assertOauthState, clearOauthState } from '@/lib/oauth-state'
import { prisma } from '@/lib/prisma'
import { assertRateLimit } from '@/lib/rate-limit'

const bodySchema = z.object({ code: z.string().min(1), state: z.string().min(1) })

export const POST = route(async (request) => {
  const { code, state } = await parseBody(request, bodySchema)
  const clientAddress = request.headers.get('x-forwarded-for') ?? 'unknown'
  assertRateLimit(`auth:${clientAddress}`, 20, 600_000, 'Слишком много попыток входа, попробуйте позже')
  await assertOauthState(state)

  const tokens = await exchangeGoogleCode(code, `${appUrl()}/login/callback`)
  const profile = await fetchGoogleProfile(tokens.accessToken)
  if (!profile.isEmailVerified) {
    throw forbidden('Адрес Google-аккаунта не подтверждён')
  }

  const user = await prisma.user.findUnique({ where: { email: profile.email } })
  if (!user) {
    throw forbidden('Этот адрес не заведён в системе. Обратитесь в учебную часть')
  }
  if (user.googleId && user.googleId !== profile.googleId) {
    throw forbidden('К этой учётной записи привязан другой Google-аккаунт')
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { googleId: profile.googleId, avatarUrl: profile.avatarUrl ?? user.avatarUrl },
  })

  const response = NextResponse.json({ user: await loadSessionUser(user.id) })
  await attachSessionCookie(response, { userId: user.id, role: user.role })
  clearOauthState(response)
  return response
})
