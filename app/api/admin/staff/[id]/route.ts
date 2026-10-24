import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { staffProfileSchema, updateStaffProfile } from '@/lib/staff/staff-service'

type Params = { id: string }

export const PATCH = route<Params>(async (request, { id }) => {
  await requireSession('ADMIN')
  const body = await parseBody(request, staffProfileSchema)
  return NextResponse.json({ member: await updateStaffProfile(prisma, id, body) })
})
