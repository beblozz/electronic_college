import { SignJWT, jwtVerify } from 'jose'
import type { Role } from '@/lib/types'

export const sessionCookieName = 'session'
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 7

export type Session = { userId: string; role: Role }

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters long')
  }
  return new TextEncoder().encode(secret)
}

export async function signSessionToken(session: Session): Promise<string> {
  return new SignJWT({ role: session.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeSeconds}s`)
    .sign(secretKey())
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) {
    return null
  }
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    const role = payload.role
    if (!payload.sub || (role !== 'STUDENT' && role !== 'TEACHER' && role !== 'ADMIN')) {
      return null
    }
    return { userId: payload.sub, role }
  } catch {
    return null
  }
}

export function homePathForRole(role: Role): string {
  if (role === 'STUDENT') {
    return '/student'
  }
  if (role === 'TEACHER') {
    return '/teacher'
  }
  return '/admin'
}
