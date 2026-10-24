import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { restoreStaff } from '@/lib/staff/staff-service'

type Params = { id: string }

export const POST = route<Params>(async (_request, { id }) => {
  await requireSession('ADMIN')
  const member = await prisma.$transaction((transaction) => restoreStaff(transaction, id))
  return NextResponse.json({ member })
})
