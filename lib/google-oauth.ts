import { ApiError } from '@/lib/http'

export const loginScope = 'openid email profile'
export const calendarScope = 'https://www.googleapis.com/auth/calendar.app.created'

function googleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new ApiError(503, 'GOOGLE_NOT_CONFIGURED', 'Google OAuth не настроен на сервере')
  }
  return { clientId, clientSecret }
}

type AuthUrlOptions = { redirectUri: string; scope: string; state: string; offlineAccess?: boolean }

export function buildGoogleAuthUrl(options: AuthUrlOptions): string {
  const params = new URLSearchParams({
    client_id: googleCredentials().clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: options.scope,
    state: options.state,
  })
  if (options.offlineAccess) {
    params.set('access_type', 'offline')
    params.set('prompt', 'consent')
  }
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export type GoogleTokens = { accessToken: string; refreshToken: string | null }

async function requestTokens(body: Record<string, string>): Promise<GoogleTokens> {
  const { clientId, clientSecret } = googleCredentials()
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...body }),
  })
  if (!response.ok) {
    throw new ApiError(400, 'GOOGLE_AUTH_FAILED', 'Google отклонил авторизацию')
  }
  const tokens = (await response.json()) as { access_token: string; refresh_token?: string }
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? null }
}

export function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleTokens> {
  return requestTokens({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' })
}

export async function refreshGoogleAccessToken(refreshToken: string): Promise<string> {
  const tokens = await requestTokens({ refresh_token: refreshToken, grant_type: 'refresh_token' })
  return tokens.accessToken
}

export type GoogleProfile = { googleId: string; email: string; isEmailVerified: boolean; avatarUrl: string | null }

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  })
  if (!response.ok) {
    throw new ApiError(400, 'GOOGLE_AUTH_FAILED', 'Не удалось получить профиль Google')
  }
  const profile = (await response.json()) as {
    sub: string
    email: string
    email_verified?: boolean
    picture?: string
  }
  return {
    googleId: profile.sub,
    email: profile.email.toLowerCase(),
    isEmailVerified: profile.email_verified === true,
    avatarUrl: profile.picture ?? null,
  }
}
