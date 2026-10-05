import type { AttendanceStatus } from '@/lib/types'

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
