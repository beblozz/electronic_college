import { teacherTeachesSubject } from '@/lib/access'
import { requireSession } from '@/lib/auth'
import { badRequest, forbidden } from '@/lib/http'
import { prisma } from '@/lib/prisma'

export async function resolveGradingTeacherId(groupId: string, subjectId: string, date: Date): Promise<string> {
  const session = await requireSession('TEACHER', 'ADMIN')

  if (session.role === 'TEACHER') {
    const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
    if (!teacher || !(await teacherTeachesSubject(prisma, teacher.id, groupId, subjectId, date))) {
      throw forbidden('Вы не ведёте этот предмет у группы')
    }
    return teacher.id
  }

  const curriculum = await prisma.curriculum.findFirst({
    where: { groupId, subjectId },
    orderBy: { semester: 'desc' },
  })
  if (!curriculum) {
    throw badRequest('Предмет не входит в учебный план группы')
  }
  return curriculum.teacherId
}

export async function assertCanEditGrade(gradeTeacherId: string): Promise<void> {
  const session = await requireSession('TEACHER', 'ADMIN')
  if (session.role === 'ADMIN') {
    return
  }
  const teacher = await prisma.teacher.findUnique({ where: { userId: session.userId } })
  if (!teacher || teacher.id !== gradeTeacherId) {
    throw forbidden('Изменять оценку может только выставивший её преподаватель')
  }
}
