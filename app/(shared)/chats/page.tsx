'use client'

import { ChevronLeft, Plus } from 'lucide-react'
import { useState } from 'react'
import { ChatList } from '@/components/chat/chat-list'
import { ChatThread } from '@/components/chat/chat-thread'
import { NewChatDialog } from '@/components/chat/new-chat-dialog'
import { useSocketEvent } from '@/components/layout/realtime-provider'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/states'
import { useApi } from '@/lib/client/api'
import { useCurrentUser } from '@/lib/client/use-current-user'
import type { ChatMessage, ChatSummary } from '@/lib/types'

export default function ChatsPage() {
  const user = useCurrentUser()
  const chats = useApi<{ chats: ChatSummary[] }>('/api/chats')
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)

  useSocketEvent<{ message: ChatMessage }>('message:new', chats.reload)

  const chatList = chats.data?.chats ?? []
  const activeChat = chatList.find((chat) => chat.id === activeChatId) ?? null

  return (
    <div className="-mx-3 -my-4 flex h-[calc(100vh-2.75rem)] md:-mx-6 md:h-screen">
      <div
        className={`w-full shrink-0 flex-col border-r border-line md:flex md:w-72 ${activeChat ? 'hidden' : 'flex'}`}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <h1 className="text-title font-medium">Чаты</h1>
          <Button size="small" onClick={() => setIsNewChatOpen(true)}>
            <Plus size={16} strokeWidth={1.5} />
            Личный
          </Button>
        </div>
        {chats.error ? <ErrorState message={chats.error} /> : null}
        <ChatList chats={chatList} activeChatId={activeChatId} onSelect={setActiveChatId} />
      </div>

      <div className={`min-w-0 flex-1 flex-col md:flex ${activeChat ? 'flex' : 'hidden'}`}>
        {activeChat && user ? (
          <>
            <div className="flex items-center gap-2 border-b border-line px-3 py-2">
              <button
                type="button"
                aria-label="К списку чатов"
                onClick={() => setActiveChatId(null)}
                className="rounded p-1 text-muted transition-colors hover:bg-subtle hover:text-ink md:hidden"
              >
                <ChevronLeft size={20} strokeWidth={1.5} />
              </button>
              <h2 className="truncate text-title font-medium">{activeChat.title}</h2>
            </div>
            <ChatThread key={activeChat.id} chat={activeChat} currentUserId={user.id} onActivity={chats.reload} />
          </>
        ) : (
          <p className="m-auto text-muted">Выберите чат</p>
        )}
      </div>

      {isNewChatOpen ? (
        <NewChatDialog
          onClose={() => setIsNewChatOpen(false)}
          onCreated={(chat) => {
            setIsNewChatOpen(false)
            chats.reload()
            setActiveChatId(chat.id)
          }}
        />
      ) : null}
    </div>
  )
}
