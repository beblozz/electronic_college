import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { notFound, route } from '@/lib/http'
import { generatePassword, hashPassword } from '@/lib/password'
import { fullName } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import type { GeneratedCredentials } from '@/lib/types'

type Params = { id: string }

export const POST = route<Params>(async (_request, { id }) => {
  await requireSession('ADMIN')
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) {
    throw notFound('Пользователь не найден')
  }
  const password = generatePassword()
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } })
  const credentials: GeneratedCredentials = { email: user.email, fullName: fullName(user), password }
  return NextResponse.json({ credentials })
})
