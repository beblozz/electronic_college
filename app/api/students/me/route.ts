import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStudent } from '@/lib/auth'
import { parseDate, todayInTimeZone } from '@/lib/dates'
import { collegeTimeZone } from '@/lib/env'
import { parseQuery, route } from '@/lib/http'
import { averageOf, serializeGrade } from '@/lib/journal/journal-service'
import { teacherRef } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { semesterForCourse } from '@/lib/schedule/week-parity'
import type { Diary, DiarySubject } from '@/lib/types'

const querySchema = z.object({ semester: z.coerce.number().int().min(1).max(12).optional() })

export const GET = route(async (request) => {
  const { student } = await requireStudent()
  const query = parseQuery(request, querySchema)
  const today = parseDate(todayInTimeZone(collegeTimeZone()))

  const [group, currentTerm] = await Promise.all([
    prisma.group.findUniqueOrThrow({ where: { id: student.groupId } }),
    prisma.term.findFirst({ where: { startDate: { lte: today }, endDate: { gte: today } } }),
  ])
  const semester = query.semester ?? (currentTerm ? semesterForCourse(group.courseYear, currentTerm.half) : null)

  const [curricula, grades, attendances] = await Promise.all([
    prisma.curriculum.findMany({
      where: { groupId: group.id, semester: semester ?? undefined },
      include: { subject: true, teacher: { include: { user: true } } },
      orderBy: { subject: { name: 'asc' } },
    }),
    prisma.grade.findMany({ where: { studentId: student.id }, orderBy: { date: 'asc' } }),
    prisma.attendance.findMany({ where: { studentId: student.id }, include: { scheduleSlot: true } }),
  ])

  const subjects: DiarySubject[] = curricula.map((curriculum) => {
    const subjectGrades = grades.filter((grade) => grade.subjectId === curriculum.subjectId)
    const subjectAttendance = attendances.filter(
      (attendance) => attendance.scheduleSlot.subjectId === curriculum.subjectId,
    )
    const countStatus = (status: string) => subjectAttendance.filter((item) => item.status === status).length
    return {
      subjectId: curriculum.subjectId,
      name: curriculum.subject.name,
      teacher: teacherRef(curriculum.teacher),
      grades: subjectGrades.map(serializeGrade),
      averageGrade: averageOf(subjectGrades.map((grade) => grade.value)),
      attendance: {
        present: countStatus('PRESENT'),
        absent: countStatus('ABSENT'),
        late: countStatus('LATE'),
        excused: countStatus('EXCUSED'),
      },
    }
  })

  const diary: Diary = {
    student: {
      id: student.id,
      group: { id: group.id, name: group.name },
      enrollmentYear: student.enrollmentYear,
      status: student.status,
    },
    semester,
    subjects,
    averageGrade: averageOf(subjects.flatMap((subject) => subject.grades.map((grade) => grade.value))),
  }
  return NextResponse.json(diary)
})
