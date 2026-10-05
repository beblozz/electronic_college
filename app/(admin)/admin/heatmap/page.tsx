'use client'

import { useState } from 'react'
import { text, useDirectory } from '@/components/admin/use-directory'
import { WeekNavigator } from '@/components/schedule/week-navigator'
import { Field, Select } from '@/components/ui/field'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states'
import { useApi } from '@/lib/client/api'
import { formatShortDate, todayLocal, weekdayShortNames, weekStartOf } from '@/lib/dates'
import type { Heatmap } from '@/lib/types'

function loadClass(pairs: number): string {
  if (pairs === 0) {
    return 'text-muted'
  }
  if (pairs <= 3) {
    return 'bg-loadLow'
  }
  if (pairs <= 5) {
    return 'bg-loadMedium'
  }
  return 'bg-loadHigh'
}

const legend = [
  { label: '1–3 пары', className: 'bg-loadLow' },
  { label: '4–5 пар', className: 'bg-loadMedium' },
  { label: '6 и больше', className: 'bg-loadHigh' },
]

export default function AdminHeatmapPage() {
  const [weekStart, setWeekStart] = useState(() => weekStartOf(todayLocal()))
  const [departmentId, setDepartmentId] = useState('')
  const departments = useDirectory('departments')
  const heatmap = useApi<Heatmap>(
    `/api/admin/load/heatmap?weekStart=${weekStart}${departmentId ? `&departmentId=${departmentId}` : ''}`,
  )

  return (
    <>
      <PageHeader title="Нагрузка преподавателей" caption="Количество пар по дням с учётом замен">
        <Field label="Кафедра" className="w-64">
          <Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">Все кафедры</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {text(department, 'name')}
              </option>
            ))}
          </Select>
        </Field>
        <WeekNavigator weekStart={weekStart} onChange={setWeekStart} />
      </PageHeader>

      {heatmap.error ? <ErrorState message={heatmap.error} /> : null}
      {!heatmap.data && heatmap.isLoading ? <LoadingState /> : null}
      {heatmap.data && heatmap.data.teachers.length === 0 ? <EmptyState>Преподавателей нет</EmptyState> : null}

      {heatmap.data && heatmap.data.teachers.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded border border-line">
            <table className="w-full border-collapse text-body [&_tbody_tr:last-child_td]:border-b-0">
              <thead>
                <tr>
                  <th className="border-b border-line bg-subtle px-3 py-1.5 text-left text-caption font-medium text-muted">
                    Преподаватель
                  </th>
                  {heatmap.data.days.map((day, index) => (
                    <th
                      key={day}
                      className="w-20 border-b border-l border-line bg-subtle px-2 py-1.5 text-center text-caption font-medium text-muted"
                    >
                      {weekdayShortNames[index]}, {formatShortDate(day)}
                    </th>
                  ))}
                  <th className="w-28 border-b border-l border-line bg-subtle px-3 py-1.5 text-right text-caption font-medium text-muted">
                    Часов
                  </th>
                </tr>
              </thead>
              <tbody>
                {heatmap.data.teachers.map((teacher) => (
                  <tr key={teacher.teacherId}>
                    <td className="whitespace-nowrap border-b border-line px-3 py-1">{teacher.fullName}</td>
                    {teacher.pairsByDay.map((pairs, index) => (
                      <td
                        key={heatmap.data?.days[index]}
                        className={`border-b border-l border-line px-2 py-1 text-center tabular-nums ${loadClass(pairs)}`}
                      >
                        {pairs === 0 ? '·' : pairs}
                      </td>
                    ))}
                    <td
                      className={`border-b border-l border-line px-3 py-1 text-right tabular-nums ${
                        teacher.isOverloaded ? 'font-medium text-danger' : ''
                      }`}
                    >
                      {teacher.weeklyHours} / {teacher.maxHoursPerWeek}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-caption text-muted">
            {legend.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span className={`inline-block h-3 w-3 rounded-sm border border-line ${item.className}`} />
                {item.label}
              </span>
            ))}
            <span className="text-danger">Красным в колонке «Часов» — превышение недельной нормы</span>
          </div>
        </>
      ) : null}
    </>
  )
}
