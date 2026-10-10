import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { listAcademicYears } from '@/lib/terms/academic-years'

export const GET = route(async () => {
  await requireSession('ADMIN')
  return NextResponse.json({ years: await listAcademicYears(prisma) })
})
