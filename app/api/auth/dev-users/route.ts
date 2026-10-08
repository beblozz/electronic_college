import { NextResponse } from 'next/server'
import { isDevLoginAllowed } from '@/lib/env'
import { notFound, route } from '@/lib/http'
import { fullName } from '@/lib/people'
import { prisma } from '@/lib/prisma'

export const GET = route(async () => {
  if (!isDevLoginAllowed()) {
    throw notFound()
  }
  const users = await prisma.user.findMany({
    include: { student: { include: { group: true } } },
    orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
  })
  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      fullName: fullName(user),
      role: user.role,
      caption: user.student?.group.name ?? user.email,
    })),
  })
})
