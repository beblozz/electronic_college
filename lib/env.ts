export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Environment variable ${name} is not set`)
  }
  return value
}

export function collegeTimeZone(): string {
  return process.env.COLLEGE_TIMEZONE ?? 'Europe/Moscow'
}

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

export function isDevLoginAllowed(): boolean {
  return process.env.ALLOW_DEV_LOGIN === 'true' && process.env.NODE_ENV !== 'production'
}
