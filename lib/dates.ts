const millisecondsPerDay = 86_400_000

export function parseDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, amount: number): Date {
  return new Date(date.getTime() + amount * millisecondsPerDay)
}

export function shiftDate(value: string, amount: number): string {
  return formatDate(addDays(parseDate(value), amount))
}

export function dayOfWeek(date: Date): number {
  return ((date.getUTCDay() + 6) % 7) + 1
}

export function startOfWeek(date: Date): Date {
  return addDays(date, 1 - dayOfWeek(date))
}

export function weekStartOf(value: string): string {
  return formatDate(startOfWeek(parseDate(value)))
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / millisecondsPerDay)
}

export function eachDate(from: Date, to: Date): Date[] {
  const dates: Date[] = []
  for (let current = from; current.getTime() <= to.getTime(); current = addDays(current, 1)) {
    dates.push(current)
  }
  return dates
}

export function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(),
  )
}

export function todayLocal(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export const weekdayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
export const weekdayShortNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${day}.${month}.${year}`
}

export function formatShortDate(value: string): string {
  const [, month, day] = value.split('-')
  return `${day}.${month}`
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
