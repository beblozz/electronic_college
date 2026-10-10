import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { badRequest, parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { academicYearSchema, listAcademicYears, saveAcademicYear } from '@/lib/terms/academic-years'

type Params = { startYear: string }

const minYear = 2000
const maxYear = 2100

export const PUT = route<Params>(async (request, { startYear }) => {
  await requireSession('ADMIN')
  const year = Number(startYear)
  if (!Number.isInteger(year) || year < minYear || year > maxYear) {
    throw badRequest('Неверный учебный год')
  }
  const body = await parseBody(request, academicYearSchema)
  await prisma.$transaction((transaction) => saveAcademicYear(transaction, year, body), { isolationLevel: 'Serializable' })
  return NextResponse.json({ years: await listAcademicYears(prisma) })
})
