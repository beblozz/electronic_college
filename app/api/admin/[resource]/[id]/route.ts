import { NextResponse } from 'next/server'
import { resolveResource } from '@/lib/admin/resources'
import { requireSession } from '@/lib/auth'
import { noContent, notFound, route } from '@/lib/http'

type Params = { resource: string; id: string }

export const GET = route<Params>(async (_request, { resource, id }) => {
  await requireSession('ADMIN')
  const item = await resolveResource(resource).get(id)
  if (!item) {
    throw notFound()
  }
  return NextResponse.json({ item })
})

export const PATCH = route<Params>(async (request, { resource, id }) => {
  await requireSession('ADMIN')
  const handlers = resolveResource(resource)
  const body = await request.json().catch(() => ({}))
  return NextResponse.json({ item: await handlers.update(id, body) })
})

export const DELETE = route<Params>(async (_request, { resource, id }) => {
  await requireSession('ADMIN')
  await resolveResource(resource).remove(id)
  return noContent()
})
