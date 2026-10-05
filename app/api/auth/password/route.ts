import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { badRequest, noContent, parseBody, route } from '@/lib/http'
import { hashPassword, minimumPasswordLength, verifyPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(minimumPasswordLength, `Пароль не короче ${minimumPasswordLength} символов`).max(200),
})

export const POST = route(async (request) => {
  const session = await requireSession()
  const { currentPassword, newPassword } = await parseBody(request, bodySchema)
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } })

  if (user.passwordHash && !(await verifyPassword(currentPassword ?? '', user.passwordHash))) {
    throw badRequest('Текущий пароль указан неверно')
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } })
  return noContent()
})
