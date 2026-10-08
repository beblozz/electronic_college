'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatShortDate, shiftDate, todayLocal, weekStartOf } from '@/lib/dates'

type WeekNavigatorProps = { weekStart: string; onChange: (weekStart: string) => void }

export function WeekNavigator({ weekStart, onChange }: WeekNavigatorProps) {
  return (
    <div className="flex items-center gap-1">
      <Button size="small" aria-label="Предыдущая неделя" onClick={() => onChange(shiftDate(weekStart, -7))}>
        <ChevronLeft size={16} strokeWidth={1.5} />
      </Button>
      <span className="min-w-28 text-center text-body tabular-nums">
        {formatShortDate(weekStart)} — {formatShortDate(shiftDate(weekStart, 6))}
      </span>
      <Button size="small" aria-label="Следующая неделя" onClick={() => onChange(shiftDate(weekStart, 7))}>
        <ChevronRight size={16} strokeWidth={1.5} />
      </Button>
      <Button size="small" variant="ghost" onClick={() => onChange(weekStartOf(todayLocal()))}>
        Сегодня
      </Button>
    </div>
  )
}
