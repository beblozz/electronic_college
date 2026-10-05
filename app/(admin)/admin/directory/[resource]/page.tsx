import { notFound } from 'next/navigation'
import { findResourceConfig } from '@/components/admin/directory-config'
import { DirectoryView } from '@/components/admin/directory-view'

type PageProps = { params: Promise<{ resource: string }> }

export default async function DirectoryPage({ params }: PageProps) {
  const { resource } = await params
  const config = findResourceConfig(resource)
  if (!config) {
    notFound()
  }
  return <DirectoryView key={config.key} config={config} />
}
