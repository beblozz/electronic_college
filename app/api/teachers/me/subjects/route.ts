import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireTeacher } from '@/lib/auth'
import { parseQuery, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import type { TeacherSubjectGroups } from '@/lib/types'

const querySchema = z.object({ semester: z.coerce.number().int().min(1).max(12).optional() })

export const GET = route(async (request) => {
  const { teacher } = await requireTeacher()
  const { semester } = parseQuery(request, querySchema)

  const curricula = await prisma.curriculum.findMany({
    where: { teacherId: teacher.id, semester },
    include: { subject: true, group: true },
    orderBy: [{ subject: { name: 'asc' } }, { group: { name: 'asc' } }],
  })

  const subjectsById = new Map<string, TeacherSubjectGroups>()
  for (const curriculum of curricula) {
    const entry = subjectsById.get(curriculum.subjectId) ?? {
      subjectId: curriculum.subjectId,
      name: curriculum.subject.name,
      code: curriculum.subject.code,
      groups: [],
    }
    entry.groups.push({ groupId: curriculum.groupId, name: curriculum.group.name, semester: curriculum.semester })
    subjectsById.set(curriculum.subjectId, entry)
  }
  return NextResponse.json({ subjects: [...subjectsById.values()] })
})
