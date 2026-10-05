import { NextResponse } from 'next/server'
import { resolveResource } from '@/lib/admin/resources'
import { requireSession } from '@/lib/auth'
import { created, route } from '@/lib/http'
import { readPage } from '@/lib/pagination'

type Params = { resource: string }

export const GET = route<Params>(async (request, { resource }) => {
  await requireSession('ADMIN')
  const params = request.nextUrl.searchParams
  return NextResponse.json(await resolveResource(resource).list(params, readPage(params)))
})

export const POST = route<Params>(async (request, { resource }) => {
  await requireSession('ADMIN')
  const handlers = resolveResource(resource)
  const body = await request.json().catch(() => ({}))
  return created({ item: await handlers.create(body) })
})
