import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { feedUrl, findOrCreateFeed } from '@/lib/calendar/feed'
import { route } from '@/lib/http'

export const GET = route(async () => {
  const session = await requireSession('STUDENT', 'TEACHER')
  const feed = await findOrCreateFeed(session.userId)
  return NextResponse.json({
    url: feedUrl(feed.token),
    isGoogleConnected: feed.googleRefreshToken !== null,
    isGoogleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
  })
})
