import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { getSocket } from '@/api/socket'
import { Send } from 'lucide-react'

interface PrivateMessage {
  id: number
  text: string
  time: number
  from: {
    cid: string
    nick: string
    hub_url: string
    flags: string[]
  }
  is_read: boolean
  reply_to: {
    cid: string
    nick: string
    hub_url: string
  }
  is_incoming: boolean
}

interface PrivateChat {
  id: number
  user: {
    cid: string
    nick: string
    hub_url: string
    flags: string[]
  }
  message_counts?: {
    unread: number
  }
}

export function MessageSession() {
  const { id } = useParams<{ id: string }>()
  const chatId = Number(id)
  const [chat, setChat] = useState<PrivateChat | null>(null)
  const [messages, setMessages] = useState<PrivateMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    // Fetch chat info
    socket.get(`private_chat/${chatId}`).then((data) => {
      setChat(data as PrivateChat)
    }).catch(() => {})

    // Fetch messages
    socket.get(`private_chat/${chatId}/messages/0`).then((data) => {
      setMessages(data as PrivateMessage[])
    }).catch(() => {})

    // Subscribe to new messages
    let removeListener: (() => void) | undefined
    const setup = async () => {
      try {
        removeListener = await socket.addListener(
          'private_chat',
          'private_chat_message',
          (msg: PrivateMessage, id: number) => {
            if (id === chatId) {
              setMessages((prev) => [...prev, msg])
            }
          },
          chatId
        )
      } catch {}
    }
    setup()

    return () => removeListener?.()
  }, [chatId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`private_chat/${chatId}/chat_message`, { text: input })
      setInput('')
    } catch {}
  }

  return (
    <div className="h-full flex flex-col -m-6">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-(--color-glass-border) shrink-0">
        <h2 className="text-sm font-medium text-(--color-text-primary)">
          {chat?.user.nick || `Chat #${chatId}`}
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2 py-0.5">
            <span className="text-micro shrink-0 opacity-50 pt-0.5">
              {new Date(msg.time * 1000).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span
              className={`text-xs font-medium shrink-0 ${
                msg.is_incoming ? 'text-(--color-link)' : 'text-(--color-success)'
              }`}
            >
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
  )
}
