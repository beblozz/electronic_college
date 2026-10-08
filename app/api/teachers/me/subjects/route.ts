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

  const [curricula, slots] = await Promise.all([
    prisma.curriculum.findMany({
      where: { teacherId: teacher.id, semester },
      include: { subject: true, group: true },
    }),
    prisma.scheduleSlot.findMany({
      where: { teacherId: teacher.id, semester },
      include: { subject: true, group: true },
      distinct: ['groupId', 'subjectId', 'semester'],
    }),
  ])

  const subjectsById = new Map<string, TeacherSubjectGroups>()
  for (const assignment of [...curricula, ...slots]) {
    const entry = subjectsById.get(assignment.subjectId) ?? {
      subjectId: assignment.subjectId,
      name: assignment.subject.name,
      code: assignment.subject.code,
      groups: [],
    }
    const isKnown = entry.groups.some(
      (group) => group.groupId === assignment.groupId && group.semester === assignment.semester,
    )
    if (!isKnown) {
      entry.groups.push({ groupId: assignment.groupId, name: assignment.group.name, semester: assignment.semester })
    }
    subjectsById.set(assignment.subjectId, entry)
  }
  const subjects = [...subjectsById.values()].sort((first, second) => first.name.localeCompare(second.name, 'ru'))
  for (const subject of subjects) {
    subject.groups.sort((first, second) => first.name.localeCompare(second.name, 'ru'))
  }
  return NextResponse.json({ subjects })
})
