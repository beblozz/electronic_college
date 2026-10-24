export type Experience = { years: number; months: number }

export function experienceBetween(from: string, to: string): Experience | null {
  if (!from || !to || from > to) {
    return null
  }
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  let totalMonths = (toYear - fromYear) * 12 + (toMonth - fromMonth)
  if (toDay < fromDay) {
    totalMonths -= 1
  }
  const safeMonths = Math.max(totalMonths, 0)
  return { years: Math.floor(safeMonths / 12), months: safeMonths % 12 }
}

function yearWord(years: number): string {
  const lastTwo = years % 100
  const last = years % 10
  if (lastTwo >= 11 && lastTwo <= 14) {
    return 'лет'
  }
  if (last === 1) {
    return 'год'
  }
  return last >= 2 && last <= 4 ? 'года' : 'лет'
}

export function formatExperience(experience: Experience | null): string {
  if (!experience) {
    return '—'
  }
  const parts: string[] = []
  if (experience.years > 0) {
    parts.push(`${experience.years} ${yearWord(experience.years)}`)
  }
  if (experience.months > 0 || experience.years === 0) {
    parts.push(`${experience.months} мес.`)
  }
  return parts.join(' ')
}
