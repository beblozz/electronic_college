import { Prisma } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { ZodError, ZodType, ZodTypeDef } from 'zod'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown = {},
  ) {
    super(message)
  }
}

export function badRequest(message: string, details: unknown = {}): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', message, details)
}

export function unauthenticated(): ApiError {
  return new ApiError(401, 'UNAUTHENTICATED', 'Требуется вход')
}

export function forbidden(message = 'Недостаточно прав'): ApiError {
  return new ApiError(403, 'FORBIDDEN', message)
}

export function notFound(message = 'Не найдено'): ApiError {
  return new ApiError(404, 'NOT_FOUND', message)
}

export function conflict(code: string, message: string, details: unknown = {}): ApiError {
  return new ApiError(409, code, message, details)
}

export function rateLimited(message: string): ApiError {
  return new ApiError(429, 'RATE_LIMITED', message)
}

function errorBody(code: string, message: string, details: unknown = {}) {
  return { error: { code, message, details } }
}

const dependencyMessage = 'Удалить нельзя: запись используется в расписании, учебном плане или журнале'
const foreignKeySqlStates = ['23001', '23503']

function isForeignKeyViolation(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }
  const details = `${error.message} ${JSON.stringify((error as { meta?: unknown }).meta ?? {})}`
  return (
    foreignKeySqlStates.some((sqlState) => details.includes(`"${sqlState}"`)) ||
    /foreign key constraint/i.test(details)
  )
}

const prismaErrorResponses: Record<string, { status: number; code: string; message: string }> = {
  P2002: { status: 409, code: 'DUPLICATE', message: 'Такая запись уже существует' },
  P2003: { status: 409, code: 'DEPENDENCY', message: dependencyMessage },
  P2014: { status: 409, code: 'DEPENDENCY', message: dependencyMessage },
  P2025: { status: 404, code: 'NOT_FOUND', message: 'Не найдено' },
  P2034: { status: 409, code: 'SCHEDULE_CONFLICT', message: 'Данные изменились, повторите действие' },
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(errorBody(error.code, error.message, error.details), { status: error.status })
  }
  if (error instanceof ZodError) {
    return NextResponse.json(errorBody('VALIDATION_ERROR', 'Проверьте введённые данные', error.flatten()), {
      status: 400,
    })
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const known = prismaErrorResponses[error.code]
    if (known) {
      return NextResponse.json(errorBody(known.code, known.message), { status: known.status })
    }
  }
  if (isForeignKeyViolation(error)) {
    return NextResponse.json(errorBody('DEPENDENCY', dependencyMessage), { status: 409 })
  }
  console.error(error)
  return NextResponse.json(errorBody('INTERNAL_ERROR', 'Внутренняя ошибка сервера'), { status: 500 })
}

type RouteContext<Params> = { params: Promise<Params> }
type RouteHandler<Params> = (request: NextRequest, params: Params) => Promise<Response>

export function route<Params = Record<string, never>>(handler: RouteHandler<Params>) {
  return async (request: NextRequest, context: RouteContext<Params>): Promise<Response> => {
    try {
      return await handler(request, await context.params)
    } catch (error) {
      return errorResponse(error)
    }
  }
}

export async function parseBody<Output, Input>(
  request: NextRequest,
  schema: ZodType<Output, ZodTypeDef, Input>,
): Promise<Output> {
  const body = await request.json().catch(() => ({}))
  return schema.parse(body)
}

export function parseQuery<Output, Input>(request: NextRequest, schema: ZodType<Output, ZodTypeDef, Input>): Output {
  return schema.parse(Object.fromEntries(request.nextUrl.searchParams))
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

export function created<Body>(body: Body): NextResponse {
  return NextResponse.json(body, { status: 201 })
}
