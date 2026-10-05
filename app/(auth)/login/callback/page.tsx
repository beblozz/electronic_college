import { Suspense } from 'react'
import { OauthCallback } from '@/components/layout/oauth-callback'

export default function LoginCallbackPage() {
  return (
    <Suspense>
      <OauthCallback endpoint="/api/auth/google" successPath="/" failurePath="/login" />
    </Suspense>
  )
}
