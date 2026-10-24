import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { dismissalSchema, dismissStaff } from '@/lib/staff/staff-service'

type Params = { id: string }

export const POST = route<Params>(async (request, { id }) => {
  await requireSession('ADMIN')
  const body = await parseBody(request, dismissalSchema)
  const member = await prisma.$transaction((transaction) => dismissStaff(transaction, id, body))
  return NextResponse.json({ member })
})
