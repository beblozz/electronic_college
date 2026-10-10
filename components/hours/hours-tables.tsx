import { balanceTone, formatHourBalance, formatPairBalance, hoursStatusLabels } from '@/components/hours/hours-format'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/states'
import { Table, Td, Th } from '@/components/ui/table'
import { formatDisplayDate } from '@/lib/dates'
import type { SubjectHours, TeacherHours } from '@/lib/types'

const statusTones = { AHEAD: 'warning', BEHIND: 'danger', ON_TRACK: 'neutral' } as const

function forecastNote(row: SubjectHours, termEnd: string | null): string {
  if (row.status === 'BEHIND') {
    return `к концу семестра не хватит ${Math.abs(row.forecastBalanceHours)} ч`
  }
  if (row.status === 'AHEAD' && row.completionDate) {
    const isEarlier = termEnd ? row.completionDate < termEnd : false
    return `план выполнится ${formatDisplayDate(row.completionDate)}${isEarlier ? `, дальше лишних пар: ${row.extraPairsAfterCompletion}` : ''}`
  }
  return 'выполняется по плану'
}

type SubjectHoursTableProps = { rows: SubjectHours[]; termEnd: string | null; showGroup?: boolean }

export function SubjectHoursTable({ rows, termEnd, showGroup = true }: SubjectHoursTableProps) {
  if (rows.length === 0) {
    return <EmptyState>Нет данных за семестр</EmptyState>
  }
  return (
    <Table>
      <thead>
        <tr>
          {showGroup ? <Th>Группа</Th> : null}
          <Th>Предмет</Th>
          <Th className="text-right">План, ч</Th>
          <Th className="text-right">По сетке на сегодня</Th>
          <Th className="text-right">Проведено</Th>
          <Th className="text-right">Разница</Th>
          <Th>Отдано / получено / сорвано</Th>
          <Th>Прогноз</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.group.id}:${row.subject.id}`} className={row.status === 'BEHIND' ? 'bg-loadHigh/40' : ''}>
            {showGroup ? <Td className="whitespace-nowrap">{row.group.name}</Td> : null}
            <Td>
              <p className="font-medium">{row.subject.name}</p>
              <p className="text-caption text-muted">{row.teacher?.fullName ?? ''}</p>
            </Td>
            <Td className="text-right tabular-nums" title={row.plannedSource === 'CURRICULUM' ? 'Из учебного плана' : 'По сетке расписания'}>
              {row.plannedHours}
              {row.plannedSource === 'SCHEDULE' ? <span className="text-muted">*</span> : null}
            </Td>
            <Td className="text-right tabular-nums">{row.scheduledHoursToDate}</Td>
            <Td className="text-right tabular-nums">{row.conductedHoursToDate}</Td>
            <Td className={`whitespace-nowrap text-right tabular-nums ${balanceTone(row.balancePairsToDate)}`}>
              {formatPairBalance(row.balancePairsToDate)}
            </Td>
            <Td className="whitespace-nowrap tabular-nums text-muted">
              {row.givenAwayPairsToDate} / {row.receivedPairsToDate} / {row.missedPairsToDate}
            </Td>
            <Td>
              <span className="flex flex-wrap items-center gap-1.5">
                <Badge tone={statusTones[row.status]}>
                  {hoursStatusLabels[row.status]}
                  {row.forecastBalanceHours !== 0 ? ` ${formatHourBalance(row.forecastBalanceHours)}` : ''}
                </Badge>
                <span className="text-caption text-muted">{forecastNote(row, termEnd)}</span>
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function TeacherHoursTable({ rows }: { rows: TeacherHours[] }) {
  if (rows.length === 0) {
    return <EmptyState>Нет данных за семестр</EmptyState>
  }
  return (
    <Table>
      <thead>
        <tr>
          <Th>Преподаватель</Th>
          <Th className="text-right">По сетке на сегодня, ч</Th>
          <Th className="text-right">Фактически, ч</Th>
          <Th className="text-right">Разница</Th>
          <Th className="text-right">Заменял, пар</Th>
          <Th className="text-right">Отдал на замену</Th>
          <Th className="text-right">Сорвано</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.teacher.id}>
            <Td className="font-medium">{row.teacher.fullName}</Td>
            <Td className="text-right tabular-nums">{row.scheduledHoursToDate}</Td>
            <Td className="text-right tabular-nums">{row.conductedHoursToDate}</Td>
            <Td className={`text-right tabular-nums ${balanceTone(row.balanceHoursToDate)}`}>
              {formatHourBalance(row.balanceHoursToDate)}
            </Td>
            <Td className="text-right tabular-nums">{row.takenPairsToDate}</Td>
            <Td className="text-right tabular-nums">{row.givenAwayPairsToDate}</Td>
            <Td className={`text-right tabular-nums ${row.missedPairsToDate > 0 ? 'text-danger' : 'text-muted'}`}>
              {row.missedPairsToDate}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

export function HoursLegend() {
  return (
    <p className="mt-2 text-caption text-muted">
      Одна пара — 2 часа. «Разница» — сколько пар предмет получил сверх сетки или недополучил на сегодня. «Отдано» —
      пары, которые провели другим предметом, «получено» — пары, взятые у другого предмета, «сорвано» — пары
      отсутствующего преподавателя без замены. Звёздочка у плана — часы посчитаны по сетке, потому что в учебном плане
      их не указали.
    </p>
  )
}
