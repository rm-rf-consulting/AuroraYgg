import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useHubStore, type ChatMessage } from '@/stores/hubStore'
import { getSocket } from '@/api/socket'
import { Send, Users } from 'lucide-react'

interface HubUser {
  cid: string
  nick: string
  share_size: number
  description: string
  tag: string
  flags: string[]
  ip4: string
  ip6: string
}

export function HubSession() {
  const { id } = useParams<{ id: string }>()
  const hubId = Number(id)
  const hub = useHubStore((s) => s.hubs.find((h) => h.id === hubId))
  const messages = useHubStore((s) => s.messages[hubId] || [])
  const fetchMessages = useHubStore((s) => s.fetchMessages)
  const sendMessage = useHubStore((s) => s.sendMessage)

  const [input, setInput] = useState('')
  const [users, setUsers] = useState<HubUser[]>([])
  const [showUsers, setShowUsers] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hubId) return
    fetchMessages(hubId)

    // Subscribe to chat messages
    const socket = getSocket()
    if (!socket) return

    let removeListener: (() => void) | undefined

    const setup = async () => {
      try {
        removeListener = await socket.addListener(
          'hubs',
          'hub_chat_message',
          (message: ChatMessage, id: number) => {
            if (id === hubId) {
              useHubStore.setState((state) => ({
                messages: {
                  ...state.messages,
                  [hubId]: [...(state.messages[hubId] || []), message],
                },
              }))
            }
          },
          hubId
        )
      } catch {}
    }
    setup()

    // Fetch users
    socket.get(`hubs/${hubId}/users/0`).then((data) => {
      setUsers(data as HubUser[])
    }).catch(() => {})

    return () => removeListener?.()
  }, [hubId, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    await sendMessage(hubId, input)
    setInput('')
  }

  if (!hub) {
    return <p className="text-caption text-center py-12">Hub not found</p>
  }

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-(--color-glass-border) flex items-center gap-3 shrink-0">
        <div className="w-2 h-2 rounded-full bg-(--color-success)" />
        <h2 className="text-sm font-medium text-(--color-text-primary) truncate flex-1">
          {hub.identity.name || hub.hub_url}
        </h2>
        <button
          onClick={() => setShowUsers(!showUsers)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors cursor-pointer ${
            showUsers
              ? 'bg-(--color-accent)/12 text-(--color-link)'
              : 'text-(--color-text-tertiary) hover:bg-white/5'
          }`}
        >
          <Users size={13} />
          {hub.counts?.user_count || 0}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat messages */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-2 py-0.5">
                <span className="text-micro shrink-0 opacity-50 pt-0.5">
                  {new Date(msg.time * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-xs font-medium text-(--color-link) shrink-0">
                  {msg.from.nick}
                </span>
                <span className="text-xs text-(--color-text-secondary) break-words min-w-0">
                  {msg.text}
                </span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-2.5 border-t border-(--color-glass-border) shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-accent) transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-9 px-3 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* User list */}
        {showUsers && (
          <div className="w-52 border-l border-(--color-glass-border) overflow-y-auto p-2">
            <span className="text-micro block px-2 py-1 font-medium">
              Users ({users.length})
            </span>
            {users.map((user) => (
              <div
                key={user.cid}
                className="px-2 py-1 text-xs text-(--color-text-secondary) truncate hover:bg-white/3 rounded"
              >
                {user.nick}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
