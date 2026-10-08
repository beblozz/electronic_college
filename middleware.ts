import { NextRequest, NextResponse } from 'next/server'
import { homePathForRole, sessionCookieName, verifySessionToken } from '@/lib/session-token'
import type { Role } from '@/lib/types'

const roleByPrefix: Array<{ prefix: string; role: Role }> = [
  { prefix: '/student', role: 'STUDENT' },
  { prefix: '/teacher', role: 'TEACHER' },
  { prefix: '/admin', role: 'ADMIN' },
]

function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl
  const session = await verifySessionToken(request.cookies.get(sessionCookieName)?.value)
  const isLoginPage = pathname.startsWith('/login')

  if (!session) {
    return isLoginPage ? NextResponse.next() : redirectTo(request, '/login')
  }
  if (isLoginPage || pathname === '/') {
    return redirectTo(request, homePathForRole(session.role))
  }
  const restricted = roleByPrefix.find(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (restricted && restricted.role !== session.role) {
    return redirectTo(request, homePathForRole(session.role))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|service-worker.js).*)'],
}
