import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { route } from '@/lib/http'

export const GET = route(async () => {
  await requireSession()
  return NextResponse.json({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null })
})
