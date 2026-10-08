import { PersonalWeek } from '@/components/schedule/personal-week'

export default function StudentSchedulePage() {
  return <PersonalWeek endpoint="/api/students/me/schedule" perspective="group" />
}
