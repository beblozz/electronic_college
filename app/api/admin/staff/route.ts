import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { parseQuery, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { listStaff } from '@/lib/staff/staff-service'

const querySchema = z.object({ archive: z.enum(['0', '1']).default('0') })

export const GET = route(async (request) => {
  await requireSession('ADMIN')
  const { archive } = parseQuery(request, querySchema)
  return NextResponse.json({ staff: await listStaff(prisma, archive === '1') })
})
