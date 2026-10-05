'use client'

import { LogOut, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { NavigationItem, navigationFor, roleLabels } from '@/components/layout/navigation'
import { RealtimeProvider, useRealtime } from '@/components/layout/realtime-provider'
import { apiFetch } from '@/lib/client/api'
import type { SessionUser } from '@/lib/types'

function isActive(item: NavigationItem, pathname: string): boolean {
  return item.isExact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
}

function NavigationList({ items, onNavigate }: { items: NavigationItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { unreadCount } = useRealtime()

  return (
    <nav className="flex flex-col gap-px px-2">
      {items.map((item) => {
        const Icon = item.icon
        const active = isActive(item, pathname)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex h-8 items-center gap-2 rounded px-2 transition-colors ${
              active ? 'bg-subtle font-medium text-ink' : 'text-muted hover:bg-subtle hover:text-ink'
            }`}
          >
            <Icon size={16} strokeWidth={1.5} />
            <span className="flex-1 truncate">{item.label}</span>
            {item.href === '/notifications' && unreadCount > 0 ? (
              <span className="rounded bg-accent px-1.5 text-caption text-white">{unreadCount}</span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

function UserBlock({ user }: { user: SessionUser }) {
  const logOut = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' })
    window.location.assign('/login')
  }
  const caption = user.student ? `${roleLabels[user.role]}, ${user.student.groupName}` : roleLabels[user.role]

  return (
    <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-body">
          {user.lastName} {user.firstName}
        </p>
        <p className="truncate text-caption text-muted">{caption}</p>
      </div>
      <button
        type="button"
        onClick={logOut}
        aria-label="Выйти"
        title="Выйти"
        className="rounded p-1.5 text-muted transition-colors hover:bg-subtle hover:text-ink"
      >
        <LogOut size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}

function Brand() {
  return <p className="truncate px-4 py-3 text-body font-medium">Электронный колледж</p>
}

export function ShellFrame({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const pathname = usePathname()
  const items = navigationFor(user.role)

  useEffect(() => {
    setIsMenuOpen(false)
  }, [pathname])

  return (
    <RealtimeProvider>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line md:flex">
          <Brand />
          <div className="flex-1 overflow-y-auto">
            <NavigationList items={items} />
          </div>
          <UserBlock user={user} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-11 items-center justify-between border-b border-line px-3 md:hidden">
            <p className="text-body font-medium">Электронный колледж</p>
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              aria-label="Меню"
              className="rounded p-1.5 text-muted transition-colors hover:bg-subtle hover:text-ink"
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
          </header>
          <main className="min-w-0 flex-1 px-3 py-4 md:px-6">{children}</main>
        </div>

        {isMenuOpen ? (
          <div className="fixed inset-0 z-30 flex bg-black/30 md:hidden" onClick={() => setIsMenuOpen(false)}>
            <div className="flex h-full w-64 flex-col bg-surface" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between pr-2">
                <Brand />
                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  aria-label="Закрыть меню"
                  className="rounded p-1.5 text-muted transition-colors hover:bg-subtle hover:text-ink"
                >
                  <X size={20} strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <NavigationList items={items} onNavigate={() => setIsMenuOpen(false)} />
              </div>
              <UserBlock user={user} />
            </div>
          </div>
        ) : null}
      </div>
    </RealtimeProvider>
  )
}
