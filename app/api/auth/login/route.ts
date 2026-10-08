import { NextResponse } from 'next/server'
import { z } from 'zod'
import { attachSessionCookie, loadSessionUser } from '@/lib/auth'
import { ApiError, parseBody, route } from '@/lib/http'
import { verifyPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import { assertRateLimit } from '@/lib/rate-limit'

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
})

const attemptsPerWindow = 10
const windowMilliseconds = 600_000

export const POST = route(async (request) => {
  const { email, password } = await parseBody(request, bodySchema)
  const clientAddress = request.headers.get('x-forwarded-for') ?? 'unknown'
  assertRateLimit(
    `login:${clientAddress}:${email}`,
    attemptsPerWindow,
    windowMilliseconds,
    'Слишком много попыток входа, попробуйте через 10 минут',
  )

  const user = await prisma.user.findUnique({ where: { email } })
  const isValid = await verifyPassword(password, user?.passwordHash ?? null)
  if (!user || !isValid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Неверная почта или пароль')
  }

  const response = NextResponse.json({ user: await loadSessionUser(user.id) })
  await attachSessionCookie(response, { userId: user.id, role: user.role })
  return response
})
