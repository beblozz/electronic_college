import { JournalView } from '@/components/journal/journal-view'

type PageProps = { params: Promise<{ groupId: string; subjectId: string }> }

export default async function TeacherJournalPage({ params }: PageProps) {
  const { groupId, subjectId } = await params
  return <JournalView groupId={groupId} subjectId={subjectId} />
}
