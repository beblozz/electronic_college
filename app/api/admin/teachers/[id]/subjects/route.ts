import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { conflict, notFound, parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { idSchema } from '@/lib/validation/common'

type Params = { id: string }

const bodySchema = z.object({ subjectIds: z.array(idSchema).max(200) })

export const POST = route<Params>(async (request, { id }) => {
  await requireSession('ADMIN')
  const { subjectIds } = await parseBody(request, bodySchema)
  const teacher = await prisma.teacher.findUnique({ where: { id } })
  if (!teacher) {
    throw notFound('Преподаватель не найден')
  }

  const assignedElsewhere = await prisma.curriculum.findFirst({
    where: { teacherId: id, subjectId: { notIn: subjectIds } },
    include: { subject: true, group: true },
  })
  if (assignedElsewhere) {
    throw conflict(
      'DEPENDENCY',
      `Нельзя снять «${assignedElsewhere.subject.name}»: преподаватель ведёт его у группы ${assignedElsewhere.group.name}`,
    )
  }

  await prisma.$transaction([
    prisma.teacherSubject.deleteMany({ where: { teacherId: id, subjectId: { notIn: subjectIds } } }),
    prisma.teacherSubject.createMany({
      data: subjectIds.map((subjectId) => ({ teacherId: id, subjectId })),
      skipDuplicates: true,
    }),
  ])

  const subjects = await prisma.subject.findMany({
    where: { teacherSubjects: { some: { teacherId: id } } },
    select: { id: true, name: true, code: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ teacherId: id, subjects })
})
