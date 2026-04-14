import { useEffect, useState } from 'react'
import { getSocket } from '@/api/socket'
import { Bell, AlertTriangle, Info, AlertCircle } from 'lucide-react'

interface LogMessage {
  id: number
  text: string
  time: number
  severity: string
  is_read: boolean
}

export function EventsSession() {
  const [messages, setMessages] = useState<LogMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const fetch = async () => {
      try {
        const data = (await socket.get('events/messages/0')) as LogMessage[]
        setMessages(data)
      } catch {}
      setLoading(false)
    }
    fetch()

    let removeListener: (() => void) | undefined

    const setup = async () => {
      try {
        removeListener = await socket.addListener(
          'events',
          'event_message',
          (msg: LogMessage) => {
            setMessages((prev) => [...prev, msg])
          }
        )
      } catch {}
    }
    setup()

    return () => removeListener?.()
  }, [])

  const filtered = filter
    ? messages.filter((m) => m.severity === filter)
    : messages

  const severityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle size={13} className="text-(--color-error)" />
      case 'warning':
        return <AlertTriangle size={13} className="text-(--color-warning)" />
      default:
        return <Info size={13} className="text-(--color-info)" />
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading text-2xl text-(--color-text-primary)">Events</h1>
        <div className="flex items-center gap-1">
          {[null, 'info', 'warning', 'error'].map((sev) => (
            <button
              key={sev ?? 'all'}
              onClick={() => setFilter(sev)}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer ${
                filter === sev
                  ? 'bg-(--color-accent)/12 text-(--color-link)'
                  : 'text-(--color-text-tertiary) hover:bg-white/5'
              }`}
            >
              {sev ?? 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-caption text-center py-12">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell size={32} className="mx-auto text-(--color-text-disabled) mb-3" />
          <p className="text-caption">No events</p>
        </div>
      ) : (
        <div className="rounded-xl bg-(--color-surface-2) divide-y divide-(--color-glass-border) overflow-hidden">
          {filtered
            .slice()
            .reverse()
            .map((msg) => (
              <div key={msg.id} className="px-4 py-2.5 flex items-start gap-3">
                <span className="mt-0.5 shrink-0">{severityIcon(msg.severity)}</span>
                <span className="text-xs text-(--color-text-secondary) flex-1 break-words">
                  {msg.text}
                </span>
                <span className="text-micro shrink-0">
                  {new Date(msg.time * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
