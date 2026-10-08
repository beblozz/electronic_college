export const pairTimes: Array<{ pairNumber: number; startTime: string; endTime: string }> = [
  { pairNumber: 1, startTime: '08:30', endTime: '10:00' },
  { pairNumber: 2, startTime: '10:10', endTime: '11:40' },
  { pairNumber: 3, startTime: '12:20', endTime: '13:50' },
  { pairNumber: 4, startTime: '14:00', endTime: '15:30' },
  { pairNumber: 5, startTime: '15:40', endTime: '17:10' },
  { pairNumber: 6, startTime: '17:20', endTime: '18:50' },
  { pairNumber: 7, startTime: '19:00', endTime: '20:30' },
  { pairNumber: 8, startTime: '20:40', endTime: '22:10' },
]

export function timesForPair(pairNumber: number): { startTime: string; endTime: string } {
  const times = pairTimes.find((item) => item.pairNumber === pairNumber) ?? pairTimes[0]
  return { startTime: times.startTime, endTime: times.endTime }
}
