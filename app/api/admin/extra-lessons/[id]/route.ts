import { requireSession } from '@/lib/auth'
import { noContent, route } from '@/lib/http'
import { deleteExtraLesson } from '@/lib/schedule/extra-lessons'

type Params = { id: string }

export const DELETE = route<Params>(async (_request, { id }) => {
  await requireSession('ADMIN')
  await deleteExtraLesson(id)
  return noContent()
})
