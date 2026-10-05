import { redirect } from 'next/navigation'

export default function DirectoryIndexPage() {
  redirect('/admin/directory/groups')
}
