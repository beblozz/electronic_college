import { requireSession } from '@/lib/auth'
import { noContent, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { syncTeacherStatuses } from '@/lib/teacher-status'

type Params = { id: string }

export const DELETE = route<Params>(async (_request, { id }) => {
  await requireSession('ADMIN')
  await prisma.teacherAbsence.delete({ where: { id } })
  await syncTeacherStatuses(prisma)
  return noContent()
})
