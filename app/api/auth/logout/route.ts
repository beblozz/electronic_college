import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth'
import { noContent, route } from '@/lib/http'

export const POST = route(async () => {
  const response = noContent()
  clearSessionCookie(response)
  return response
})

export const GET = route(async (request) => {
  const response = NextResponse.redirect(new URL('/login', request.url))
  clearSessionCookie(response)
  return response
})
