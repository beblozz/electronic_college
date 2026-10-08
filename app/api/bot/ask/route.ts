import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/auth'
import { parseBody, route } from '@/lib/http'
import { answerQuestion } from '@/lib/rag/knowledge-base'
import { assertRateLimit } from '@/lib/rate-limit'

const bodySchema = z.object({ question: z.string().trim().min(1).max(1000) })
const questionsPerHour = 20

export const POST = route(async (request) => {
  const session = await requireSession('STUDENT', 'TEACHER')
  const { question } = await parseBody(request, bodySchema)
  assertRateLimit(`bot:${session.userId}`, questionsPerHour, 3_600_000, 'Лимит вопросов исчерпан, попробуйте через час')
  return NextResponse.json(await answerQuestion(question))
})
