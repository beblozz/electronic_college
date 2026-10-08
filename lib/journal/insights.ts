import type { PlanProgress, StudentFlag, StudentInsight } from '@/lib/types'

export const lowAverageThreshold = 3
export const absenceShareThreshold = 0.3
export const minimumLessonsForAbsences = 3
export const owedWorksThreshold = 2
export const minimumMedianForComparison = 2

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((first, second) => first - second)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const lastTwo = count % 100
  const last = count % 10
  if (lastTwo >= 11 && lastTwo <= 14) {
    return many
  }
  if (last === 1) {
    return one
  }
  return last >= 2 && last <= 4 ? few : many
}

type InsightInput = {
  gradeCount: number
  averageGrade: number | null
  absences: number
  lessonsHeld: number
  plan: PlanProgress | null
  medianGradeCount: number
}

export function buildInsight(input: InsightInput): StudentInsight {
  const flags: StudentFlag[] = []
  const reasons: string[] = []

  if (input.averageGrade !== null && input.averageGrade < lowAverageThreshold) {
    flags.push('LOW_AVERAGE')
    reasons.push(`средний балл ${input.averageGrade.toFixed(2)}`)
  }
  const isAbsenceCountMeaningful = input.lessonsHeld >= minimumLessonsForAbsences
  if (isAbsenceCountMeaningful && input.absences / input.lessonsHeld >= absenceShareThreshold) {
    flags.push('MANY_ABSENCES')
    reasons.push(`пропустил ${input.absences} из ${input.lessonsHeld} пар`)
  }
  if (input.plan && input.plan.owed >= owedWorksThreshold) {
    flags.push('BEHIND_PLAN')
    reasons.push(
      `не сдал ${input.plan.owed} ${pluralize(input.plan.owed, 'работу', 'работы', 'работ')} по КТП, срок которых прошёл`,
    )
  }
  const hasComparableGroup = input.medianGradeCount >= minimumMedianForComparison
  if (hasComparableGroup && input.gradeCount <= input.medianGradeCount / 2) {
    flags.push('FEW_GRADES')
    reasons.push(
      `${input.gradeCount} ${pluralize(input.gradeCount, 'оценка', 'оценки', 'оценок')}, у группы обычно ${input.medianGradeCount}`,
    )
  }

  const isLagging = flags.some((flag) => flag !== 'FEW_GRADES')
  return {
    flags,
    isLagging,
    needsAttention: !isLagging && flags.includes('FEW_GRADES'),
    gradeCount: input.gradeCount,
    absences: input.absences,
    lessonsHeld: input.lessonsHeld,
    reasons,
  }
}
