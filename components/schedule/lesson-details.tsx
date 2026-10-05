import { Badge } from '@/components/ui/badge'
import type { Lesson, LessonSubstitution } from '@/lib/types'

export type SchedulePerspective = 'group' | 'teacher' | 'full'

type LessonDetailsProps = { lesson: Lesson; perspective: SchedulePerspective; ownTeacherId?: string }

function secondaryLine(lesson: Lesson, perspective: SchedulePerspective): string {
  const room = `ауд. ${lesson.room.number}`
  if (perspective === 'group') {
    return `${lesson.teacher.fullName} · ${room}`
  }
  if (perspective === 'teacher') {
    return `${lesson.group.name} · ${room}`
  }
  return `${lesson.group.name} · ${lesson.teacher.fullName} · ${room}`
}

function substitutionNote(substitution: LessonSubstitution, isTakenOver: boolean): string {
  if (isTakenOver) {
    return `ведёт ${substitution.substituteTeacher.fullName}`
  }
  const replaced =
    substitution.kind === 'SAME_SUBJECT'
      ? substitution.originalTeacher.fullName
      : `${substitution.originalSubject.name}, ${substitution.originalTeacher.fullName}`
  if (substitution.kind === 'COMBINED' && substitution.combinedWithGroupName) {
    return `с группой ${substitution.combinedWithGroupName}, вместо: ${replaced}`
  }
  return `вместо: ${replaced}`
}

export function LessonDetails({ lesson, perspective, ownTeacherId }: LessonDetailsProps) {
  const isTakenOver = Boolean(ownTeacherId && lesson.substitution && lesson.teacher.id !== ownTeacherId)

  return (
    <div className={isTakenOver ? 'text-muted' : ''}>
      <p className={`font-medium ${isTakenOver ? 'line-through' : ''}`}>
        {isTakenOver && lesson.substitution ? lesson.substitution.originalSubject.name : lesson.subject.name}
      </p>
      <p className="text-caption text-muted">{secondaryLine(lesson, perspective)}</p>
      {lesson.substitution ? (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <Badge tone="accent">{lesson.substitution.kind === 'COMBINED' ? 'Совмещение' : 'Замена'}</Badge>
          <span className="text-caption text-muted">{substitutionNote(lesson.substitution, isTakenOver)}</span>
        </div>
      ) : null}
    </div>
  )
}
