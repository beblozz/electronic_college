import { NextResponse } from 'next/server'
import { appUrl } from '@/lib/env'
import { buildGoogleAuthUrl, loginScope } from '@/lib/google-oauth'
import { route } from '@/lib/http'
import { attachOauthState, createOauthState } from '@/lib/oauth-state'

export const GET = route(async () => {
  const state = createOauthState()
  const url = buildGoogleAuthUrl({ redirectUri: `${appUrl()}/login/callback`, scope: loginScope, state })
  const response = NextResponse.json({ url })
  attachOauthState(response, state)
  return response
})
