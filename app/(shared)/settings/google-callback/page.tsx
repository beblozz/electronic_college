import { Suspense } from 'react'
import { OauthCallback } from '@/components/layout/oauth-callback'

export default function GoogleCalendarCallbackPage() {
  return (
    <Suspense>
      <OauthCallback endpoint="/api/calendar/google/connect" successPath="/settings" failurePath="/settings" />
    </Suspense>
  )
}
