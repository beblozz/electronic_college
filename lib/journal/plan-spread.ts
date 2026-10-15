export function spreadDate(dates: string[], index: number, count: number): string | null {
  if (count > dates.length) {
    return dates[index] ?? null
  }
  return dates[Math.round(((index + 1) * dates.length) / count) - 1] ?? null
}
