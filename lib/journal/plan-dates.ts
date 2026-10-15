import { currentTerm } from '@/lib/journal/study-plan'
import type { DatabaseClient } from '@/lib/prisma'
import { expandLessons } from '@/lib/schedule/expand-lessons'

export async function subjectLessonDates(db: DatabaseClient, groupId: string, subjectId: string): Promise<string[]> {
  const term = await currentTerm(db)
  if (!term) {
    return []
  }
  const lessons = await expandLessons(db, { from: term.startDate, to: term.endDate, filter: { groupId } })
  const dates = new Set(lessons.filter((lesson) => lesson.subject.id === subjectId).map((lesson) => lesson.date))
  return [...dates].sort()
}
