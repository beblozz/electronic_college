import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import { randomToken } from '@/lib/crypto'
import { badRequest } from '@/lib/http'

const stateCookieName = 'oauth_state'

export function createOauthState(): string {
  return randomToken(16)
}

export function attachOauthState(response: NextResponse, state: string): void {
  response.cookies.set(stateCookieName, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  })
}

export async function assertOauthState(state: string): Promise<void> {
  const cookieStore = await cookies()
  const expected = cookieStore.get(stateCookieName)?.value
  if (!expected || expected !== state) {
    throw badRequest('Сессия входа устарела, начните заново')
  }
}

export function clearOauthState(response: NextResponse): void {
  response.cookies.set(stateCookieName, '', { httpOnly: true, path: '/', maxAge: 0 })
}
