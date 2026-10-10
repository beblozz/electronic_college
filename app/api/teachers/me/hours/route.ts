import { NextResponse } from 'next/server'
import { requireTeacher } from '@/lib/auth'
import { buildProgramHoursReport } from '@/lib/hours/program-hours'
import { route } from '@/lib/http'
import { currentTerm } from '@/lib/journal/study-plan'
import { prisma } from '@/lib/prisma'

export const GET = route(async () => {
  const { teacher } = await requireTeacher()
  const term = await currentTerm(prisma)
  return NextResponse.json(await buildProgramHoursReport(prisma, { term, teacherId: teacher.id }))
})
