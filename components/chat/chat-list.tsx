import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/dates'
import type { ChatSummary, ChatType } from '@/lib/types'

const typeLabels: Record<ChatType, string> = { GROUP: 'Группа', SUBJECT: 'Предмет', PRIVATE: 'Личный' }

type ChatListProps = { chats: ChatSummary[]; activeChatId: string | null; onSelect: (chatId: string) => void }

export function ChatList({ chats, activeChatId, onSelect }: ChatListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {chats.length === 0 ? <p className="px-3 py-4 text-caption text-muted">Чатов пока нет</p> : null}
      {chats.map((chat) => (
        <button
          key={chat.id}
          type="button"
          onClick={() => onSelect(chat.id)}
          className={`block w-full border-b border-line px-3 py-2 text-left transition-colors ${
            chat.id === activeChatId ? 'bg-subtle' : 'hover:bg-subtle'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{chat.title}</span>
            {chat.unreadCount > 0 ? <Badge tone="accent">{chat.unreadCount}</Badge> : null}
          </div>
          <div className="flex items-center justify-between gap-2 text-caption text-muted">
            <span className="truncate">{chat.lastMessage?.content ?? typeLabels[chat.type]}</span>
            {chat.lastMessage ? (
              <span className="shrink-0 tabular-nums">{formatDateTime(chat.lastMessage.createdAt)}</span>
            ) : null}
          </div>
        </button>
      ))}
    </div>
  )
}
