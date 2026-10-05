import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { badRequest, created, route } from '@/lib/http'
import { ingestDocument, listDocuments } from '@/lib/rag/knowledge-base'

const maxFileBytes = 10 * 1024 * 1024

export const GET = route(async () => {
  await requireSession('ADMIN')
  return NextResponse.json({ items: await listDocuments() })
})

export const POST = route(async (request) => {
  const session = await requireSession('ADMIN')
  const form = await request.formData()
  const file = form.get('file')
  const title = String(form.get('title') ?? '').trim()
  if (!(file instanceof File) || file.size === 0) {
    throw badRequest('Приложите файл')
  }
  if (file.size > maxFileBytes) {
    throw badRequest('Файл больше 10 МБ')
  }
  const document = await ingestDocument({
    title: title.length > 0 ? title : file.name,
    fileName: file.name,
    content: Buffer.from(await file.arrayBuffer()),
    uploadedById: session.userId,
  })
  return created({ document })
})
