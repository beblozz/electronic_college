import { formatDisplayDate } from '@/lib/dates'
import type { NotificationDto } from '@/lib/types'

export type NotificationText = { title: string; text: string; href: string }

function field(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

export function describeNotification(notification: NotificationDto): NotificationText {
  const { payload } = notification
  if (notification.type === 'SUBSTITUTION_CREATED') {
    return {
      title: 'Замена в расписании',
      text: `${formatDisplayDate(field(payload, 'date'))}, ${field(payload, 'pairNumber')} пара, ${field(payload, 'groupName')}: ${field(payload, 'subjectName')} — ${field(payload, 'substituteTeacherName')}`,
      href: '/',
    }
  }
  if (notification.type === 'GRADE_CREATED') {
    return {
      title: 'Новая оценка',
      text: `${field(payload, 'subjectName')}: ${field(payload, 'value')} за ${formatDisplayDate(field(payload, 'date'))}`,
      href: '/student/grades',
    }
  }
  if (notification.type === 'ABSENCE_REPORTED') {
    return {
      title: 'Преподаватель заболел',
      text: `${field(payload, 'teacherName')}: ${formatDisplayDate(field(payload, 'startDate'))} — ${formatDisplayDate(field(payload, 'endDate'))}, пар без замены: ${field(payload, 'lessonCount')}`,
      href: '/admin/substitutions',
    }
  }
  return { title: 'Объявление', text: field(payload, 'title'), href: '/announcements' }
}
