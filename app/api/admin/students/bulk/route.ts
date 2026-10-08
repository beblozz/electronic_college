import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { syncGroupChats } from '@/lib/chat/chat-membership'
import { badRequest, created, parseBody, route } from '@/lib/http'
import { generatePassword, hashPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import type { GeneratedCredentials } from '@/lib/types'
import { idSchema } from '@/lib/validation/common'

const nameSchema = z.string().trim().min(1).max(200)

const bodySchema = z.object({
  groupId: idSchema,
  enrollmentYear: z.number().int().min(2000).max(2100),
  students: z
    .array(z.object({ email: z.string().trim().toLowerCase().email(), lastName: nameSchema, firstName: nameSchema }))
    .min(1)
    .max(100),
})

export const POST = route(async (request) => {
  await requireSession('ADMIN')
  const { groupId, enrollmentYear, students } = await parseBody(request, bodySchema)

  const emails = students.map((student) => student.email)
  if (new Set(emails).size !== emails.length) {
    throw badRequest('В списке повторяются адреса почты')
  }
  const existingUsers = await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } })
  if (existingUsers.length > 0) {
    throw badRequest(`Уже есть в системе: ${existingUsers.map((user) => user.email).join(', ')}`)
  }

  const prepared = await Promise.all(
    students.map(async (student) => {
      const password = generatePassword()
      return { ...student, password, passwordHash: await hashPassword(password) }
    }),
  )

  await prisma.$transaction(
    prepared.map((student) =>
      prisma.user.create({
        data: {
          email: student.email,
          firstName: student.firstName,
          lastName: student.lastName,
          role: 'STUDENT',
          passwordHash: student.passwordHash,
          student: { create: { groupId, enrollmentYear } },
        },
      }),
    ),
  )
  await syncGroupChats(prisma, groupId)

  const credentials: GeneratedCredentials[] = prepared.map((student) => ({
    email: student.email,
    fullName: `${student.lastName} ${student.firstName}`,
    password: student.password,
  }))
  return created({ credentials })
})
