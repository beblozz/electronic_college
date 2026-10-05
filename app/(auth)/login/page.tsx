import { LoginPanel } from '@/components/layout/login-panel'
import { isDevLoginAllowed } from '@/lib/env'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <LoginPanel isGoogleConfigured={Boolean(process.env.GOOGLE_CLIENT_ID)} isDevLoginAllowed={isDevLoginAllowed()} />
    </main>
  )
}
