'use client'

import { CalendarSettings } from '@/components/layout/calendar-settings'
import { PasswordSettings } from '@/components/layout/password-settings'
import { PushSettings } from '@/components/layout/push-settings'
import { PageHeader } from '@/components/ui/page-header'
import { useCurrentUser } from '@/lib/client/use-current-user'

export default function SettingsPage() {
  const user = useCurrentUser()
  const hasPersonalSchedule = user?.role === 'STUDENT' || user?.role === 'TEACHER'

  return (
    <div className="max-w-2xl">
      <PageHeader title="Настройки" />
      <div className="flex flex-col gap-6">
        <PasswordSettings />
        <PushSettings />
        {hasPersonalSchedule ? <CalendarSettings /> : null}
      </div>
    </div>
  )
}
