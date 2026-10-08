import { PersonalWeek } from '@/components/schedule/personal-week'

export default function TeacherSchedulePage() {
  return <PersonalWeek endpoint="/api/teachers/me/schedule" perspective="teacher" />
}
