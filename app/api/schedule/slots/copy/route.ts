import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { weekdayNames } from '@/lib/dates'
import { badRequest, parseBody, route } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { findSlotConflicts } from '@/lib/schedule/conflicts'
import type { GridCopyResult } from '@/lib/types'
import { idSchema } from '@/lib/validation/common'

const semesterSchema = z.number().int().min(1).max(12)

const bodySchema = z.object({
  groupId: idSchema,
  fromSemester: semesterSchema,
  toSemester: semesterSchema,
  includeCurriculum: z.boolean(),
})

export const POST = route(async (request) => {
  await requireSession('ADMIN')
  const body = await parseBody(request, bodySchema)
  if (body.fromSemester === body.toSemester) {
    throw badRequest('Выберите другой семестр')
  }

  const result = await prisma.$transaction(
    async (transaction) => {
      let curriculaCreated = 0
      if (body.includeCurriculum) {
        const sourceCurricula = await transaction.curriculum.findMany({
          where: { groupId: body.groupId, semester: body.fromSemester },
        })
        for (const curriculum of sourceCurricula) {
          const existing = await transaction.curriculum.findUnique({
            where: {
              groupId_subjectId_semester: {
                groupId: body.groupId,
                subjectId: curriculum.subjectId,
                semester: body.toSemester,
              },
            },
          })
          if (!existing) {
            await transaction.curriculum.create({
              data: {
                groupId: body.groupId,
                subjectId: curriculum.subjectId,
                teacherId: curriculum.teacherId,
                semester: body.toSemester,
              },
            })
            curriculaCreated += 1
          }
        }
      }

      const [slots, targetCurricula] = await Promise.all([
        transaction.scheduleSlot.findMany({
          where: { groupId: body.groupId, semester: body.fromSemester, extraDate: null },
          include: { subject: true },
          orderBy: [{ dayOfWeek: 'asc' }, { pairNumber: 'asc' }],
        }),
        transaction.curriculum.findMany({ where: { groupId: body.groupId, semester: body.toSemester } }),
      ])
      const plannedSubjectIds = new Set(targetCurricula.map((curriculum) => curriculum.subjectId))
      const copied: GridCopyResult = { created: 0, curriculaCreated, skipped: [] }
      for (const slot of slots) {
        const place = `${weekdayNames[slot.dayOfWeek - 1]}, ${slot.pairNumber} пара, «${slot.subject.name}»`
        if (!plannedSubjectIds.has(slot.subjectId)) {
          copied.skipped.push(`${place}: предмета нет в учебном плане ${body.toSemester} семестра`)
          continue
        }
        const candidate = {
          groupId: slot.groupId,
          teacherId: slot.teacherId,
          roomId: slot.roomId,
          dayOfWeek: slot.dayOfWeek,
          pairNumber: slot.pairNumber,
          weekType: slot.weekType,
          semester: body.toSemester,
        }
        const conflicts = await findSlotConflicts(transaction, candidate)
        if (conflicts.length > 0) {
          copied.skipped.push(`${place}: ${conflicts[0].message}`)
          continue
        }
        await transaction.scheduleSlot.create({
          data: { ...candidate, subjectId: slot.subjectId, startTime: slot.startTime, endTime: slot.endTime },
        })
        copied.created += 1
      }
      return copied
    },
    { isolationLevel: 'Serializable', timeout: 30000 },
  )
  return NextResponse.json(result)
})
