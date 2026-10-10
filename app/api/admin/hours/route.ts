import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { buildProgramHoursReport } from '@/lib/hours/program-hours'
import { parseQuery, route } from '@/lib/http'
import { currentTerm } from '@/lib/journal/study-plan'
import { prisma } from '@/lib/prisma'
import { idSchema } from '@/lib/validation/common'

const querySchema = z.object({ termId: idSchema.optional(), groupId: idSchema.optional() })

export const GET = route(async (request) => {
  await requireSession('ADMIN')
  const { termId, groupId } = parseQuery(request, querySchema)
  const term = termId ? await prisma.term.findUnique({ where: { id: termId } }) : await currentTerm(prisma)
  return NextResponse.json(await buildProgramHoursReport(prisma, { term, groupId }))
})
