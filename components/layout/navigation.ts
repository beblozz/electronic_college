import {
  Bell,
  BookOpen,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  Clock,
  Database,
  FileText,
  Grid3x3,
  Hourglass,
  LayoutDashboard,
  LayoutList,
  ListChecks,
  LucideIcon,
  Megaphone,
  MessagesSquare,
  Repeat,
  Settings,
} from 'lucide-react'
import type { Role } from '@/lib/types'

export type NavigationItem = { label: string; href: string; icon: LucideIcon; isExact?: boolean }

const sharedItems: NavigationItem[] = [
  { label: 'Чаты', href: '/chats', icon: MessagesSquare },
  { label: 'Объявления', href: '/announcements', icon: Megaphone },
  { label: 'Уведомления', href: '/notifications', icon: Bell },
  { label: 'Настройки', href: '/settings', icon: Settings },
]

const assistantItem: NavigationItem = { label: 'Помощник', href: '/bot', icon: CircleHelp }

const itemsByRole: Record<Role, NavigationItem[]> = {
  STUDENT: [
    { label: 'Дневник', href: '/student', icon: BookOpen, isExact: true },
    { label: 'Расписание', href: '/student/schedule', icon: CalendarDays },
    { label: 'Оценки', href: '/student/grades', icon: ListChecks },
    assistantItem,
  ],
  TEACHER: [
    { label: 'Сегодня', href: '/teacher', icon: LayoutList, isExact: true },
    { label: 'Расписание', href: '/teacher/schedule', icon: CalendarDays },
    { label: 'Журнал', href: '/teacher/journal', icon: ClipboardList },
    { label: 'Нагрузка', href: '/teacher/load', icon: Clock },
    assistantItem,
  ],
  ADMIN: [
    { label: 'Обзор', href: '/admin', icon: LayoutDashboard, isExact: true },
    { label: 'Расписание', href: '/admin/schedule', icon: CalendarDays },
    { label: 'Замены', href: '/admin/substitutions', icon: Repeat },
    { label: 'Нагрузка', href: '/admin/heatmap', icon: Grid3x3 },
    { label: 'Вычитка часов', href: '/admin/hours', icon: Hourglass },
    { label: 'Журнал', href: '/admin/journal', icon: ClipboardList },
    { label: 'Справочники', href: '/admin/directory', icon: Database },
    { label: 'Документы', href: '/admin/documents', icon: FileText },
  ],
}

export function navigationFor(role: Role): NavigationItem[] {
  return [...itemsByRole[role], ...sharedItems]
}

export const roleLabels: Record<Role, string> = {
  STUDENT: 'Студент',
  TEACHER: 'Преподаватель',
  ADMIN: 'Учебная часть',
}
