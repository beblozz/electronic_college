import { NextResponse } from 'next/server'
import { z } from 'zod'
import { attachSessionCookie, loadSessionUser } from '@/lib/auth'
import { isDevLoginAllowed } from '@/lib/env'
import { notFound, parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { idSchema } from '@/lib/validation/common'

export const POST = route(async (request) => {
  if (!isDevLoginAllowed()) {
    throw notFound()
  }
  const { userId } = await parseBody(request, z.object({ userId: idSchema }))
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw notFound('Пользователь не найден')
  }
  const response = NextResponse.json({ user: await loadSessionUser(user.id) })
  await attachSessionCookie(response, { userId: user.id, role: user.role })
  return response
})
