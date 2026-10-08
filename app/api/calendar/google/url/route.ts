import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { appUrl } from '@/lib/env'
import { buildGoogleAuthUrl, calendarScope } from '@/lib/google-oauth'
import { route } from '@/lib/http'
import { attachOauthState, createOauthState } from '@/lib/oauth-state'

export const GET = route(async () => {
  await requireSession('STUDENT', 'TEACHER')
  const state = createOauthState()
  const url = buildGoogleAuthUrl({
    redirectUri: `${appUrl()}/settings/google-callback`,
    scope: calendarScope,
    state,
    offlineAccess: true,
  })
  const response = NextResponse.json({ url })
  attachOauthState(response, state)
  return response
})
