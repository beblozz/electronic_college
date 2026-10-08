import { requireSession } from '@/lib/auth'
import { forbidden, noContent, notFound, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'

type Params = { id: string }

export const DELETE = route<Params>(async (_request, { id }) => {
  const session = await requireSession()
  const announcement = await prisma.announcement.findUnique({ where: { id } })
  if (!announcement) {
    throw notFound('Объявление не найдено')
  }
  if (session.role !== 'ADMIN' && announcement.authorId !== session.userId) {
    throw forbidden()
  }
  await prisma.announcement.delete({ where: { id } })
  return noContent()
})
