import { requireSession } from '@/lib/auth'
import { noContent, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'

type Params = { id: string }

export const DELETE = route<Params>(async (_request, { id }) => {
  await requireSession('ADMIN')
  await prisma.knowledgeDocument.delete({ where: { id } })
  return noContent()
})
