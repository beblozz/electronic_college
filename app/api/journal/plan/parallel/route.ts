import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { forbidden, parseQuery, route } from '@/lib/http'
import { parallelGroups } from '@/lib/journal/plan-parallel'
import { prisma } from '@/lib/prisma'
import { idSchema } from '@/lib/validation/common'

const querySchema = z.object({ groupId: idSchema, subjectId: idSchema })

export const GET = route(async (request) => {
  const session = await requireSession('TEACHER', 'ADMIN')
  const query = parseQuery(request, querySchema)
  let teacherId: string | null = null
  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher) {
      throw forbidden()
    }
    teacherId = teacher.id
  }
  const groups = await parallelGroups(prisma, query.groupId, query.subjectId, teacherId)
  return NextResponse.json({ groups })
})
