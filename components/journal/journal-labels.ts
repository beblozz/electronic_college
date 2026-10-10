import type { AttendanceStatus, GradeKind, PlanItemKind, PlanStatus } from '@/lib/types'

export const attendanceMarks: Record<AttendanceStatus, string> = {
  PRESENT: '',
  ABSENT: 'Н',
  LATE: 'О',
  EXCUSED: 'У',
}

export const attendanceLabels: Record<AttendanceStatus, string> = {
  PRESENT: 'Присутствовал',
  ABSENT: 'Отсутствовал',
  LATE: 'Опоздал',
  EXCUSED: 'Уважительная причина',
}

export const attendanceStatuses: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']

export const gradeKindLabels: Record<GradeKind, string> = {
  ANSWER: 'Ответ',
  SURVEY: 'Опрос',
  PRACTICAL: 'Практическая работа',
  LECTURE: 'Ответ на лекции',
  TEST: 'Контрольная работа',
}

export const gradeKinds = Object.keys(gradeKindLabels) as GradeKind[]

export const planItemKindLabels: Record<PlanItemKind, string> = {
  LECTURE: 'Лекция',
  PRACTICAL: 'Практическая работа',
}

export const gradeKindForPlanItem: Record<PlanItemKind, GradeKind> = {
  LECTURE: 'LECTURE',
  PRACTICAL: 'PRACTICAL',
}

export const planStatusLabels: Record<PlanStatus, string> = {
  AUTO_CREDIT: 'Автомат',
  ADMITTED: 'Допуск',
  NOT_ADMITTED: 'Нет допуска',
}

export function planItemLabel(item: { kind: PlanItemKind; title: string; position: number }): string {
  return `${item.position + 1}. ${item.title}`
}
