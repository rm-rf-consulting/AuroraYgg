import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useHubStore, type HubMessage } from '@/stores/hubStore'
import { getSocket } from '@/api/socket'
import { formatBytes } from '@/lib/utils'
import { toast } from '@/components/shared/Toast'
import { Send, Users, FileSearch, LogOut, RefreshCw, Lock } from 'lucide-react'

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
  const navigate = useNavigate()
  const hubId = Number(id)
  const hub = useHubStore((s) => s.hubs.find((h) => h.id === hubId))
  const messages = useHubStore((s) => s.messages[hubId] || [])
  const fetchMessages = useHubStore((s) => s.fetchMessages)
  const sendMessage = useHubStore((s) => s.sendMessage)
  const disconnectHub = useHubStore((s) => s.disconnectHub)
  const reconnectHub = useHubStore((s) => s.reconnectHub)
  const fetchHubs = useHubStore((s) => s.fetchHubs)

  const [input, setInput] = useState('')
  const [users, setUsers] = useState<HubUser[]>([])
  const [showUsers, setShowUsers] = useState(true)
  const [userFilter, setUserFilter] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!hubId) return
    fetchMessages(hubId)

    const socket = getSocket()
    if (!socket) return

    let removeListener: (() => void) | undefined

    const setup = async () => {
      try {
        // Chat messages
        const r1 = await socket.addListener(
          'hubs',
          'hub_chat_message',
          (data: { chat_message: { id: number; text: string; time: number; from: { cid: string; nick: string; flags: string[] }; third_person: boolean } }, id: number) => {
            if (id === hubId && data.chat_message) {
              const cm = data.chat_message
              const msg: HubMessage = {
                id: cm.id,
                text: cm.text,
                time: cm.time,
                type: 'chat',
                from: { cid: cm.from.cid, nick: cm.from.nick.trim(), flags: cm.from.flags },
                third_person: cm.third_person,
              }
              useHubStore.setState((state) => ({
                messages: {
                  ...state.messages,
                  [hubId]: [...(state.messages[hubId] || []), msg],
                },
              }))
            }
          },
          hubId
        )
        removeListener = r1

        // Status messages
        await socket.addListener(
          'hubs',
          'hub_status_message',
          (data: { log_message: { id: number; text: string; time: number; severity: string } }, id: number) => {
            if (id === hubId && data.log_message) {
              const lm = data.log_message
              const msg: HubMessage = {
                id: lm.id,
                text: lm.text,
                time: lm.time,
                type: 'log',
                severity: lm.severity,
              }
              useHubStore.setState((state) => ({
                messages: {
                  ...state.messages,
                  [hubId]: [...(state.messages[hubId] || []), msg],
                },
              }))
            }
          },
          hubId
        )
      } catch {
        // Non-critical
      }
    }
    setup()

    // Fetch users
    socket.get(`hubs/${hubId}/users/0/1000`).then((data) => {
      setUsers(data as HubUser[])
    }).catch(() => {
      toast.error('Failed to load user list')
    })

    return () => removeListener?.()
  }, [hubId, fetchMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    try {
      await sendMessage(hubId, input)
      setInput('')
    } catch {
      toast.error('Failed to send message')
    }
  }

  const handleDisconnect = async () => {
    await disconnectHub(hubId)
    toast.info('Disconnected from hub')
    fetchHubs()
  }

  const handleReconnect = async () => {
    await reconnectHub(hubId)
    toast.info('Reconnecting...')
    fetchHubs()
    setTimeout(() => fetchMessages(hubId), 2000)
  }

  const handleBrowseUser = async (user: HubUser) => {
    const socket = getSocket()
    if (!socket) return
    try {
      const result = await socket.post('filelists', {
        user: { cid: user.cid, hub_url: hub?.hub_url },
      }) as { id?: number }
      toast.success(`Loading filelist of ${user.nick}...`)
      // Navigate to the filelist page
      if (result?.id) {
        navigate(`/filelists/${result.id}`)
      }
    } catch {
      toast.error(`Failed to browse ${user.nick}`)
    }
  }

  // Sort: online first, then alphabetically
  const sortedUsers = [...users].sort((a, b) => {
    const aOnline = !a.flags.includes('offline')
    const bOnline = !b.flags.includes('offline')
    if (aOnline !== bOnline) return aOnline ? -1 : 1
    return a.nick.localeCompare(b.nick)
  })

  const filteredUsers = userFilter
    ? sortedUsers.filter((u) => u.nick.toLowerCase().includes(userFilter.toLowerCase()))
    : sortedUsers

  const onlineCount = users.filter((u) => !u.flags.includes('offline')).length

  if (!hub) {
    return <p className="text-caption text-center py-12">Hub not found</p>
  }

  return (
    <div className="h-full flex flex-col -m-4 md:-m-6">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-(--color-glass-border) flex items-center gap-3 shrink-0">
        <div
          className={`w-2 h-2 rounded-full shrink-0 ${
            hub.connect_state?.id === 'connected' ? 'bg-(--color-success)' :
            hub.connect_state?.id === 'connecting' ? 'bg-(--color-warning) animate-pulse' :
            'bg-(--color-text-disabled)'
          }`}
        />
        <h2 className="text-sm font-medium text-(--color-text-primary) truncate flex-1">
          {hub.identity.name || hub.hub_url}
        </h2>
        {hub.encryption && (
          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-(--color-success)/10 text-(--color-success)">
            <Lock size={10} />
            TLS
          </span>
        )}
        {hub.connect_state?.id === 'disconnected' ? (
          <button
            onClick={handleReconnect}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-(--color-text-tertiary) hover:bg-(--color-success)/10 hover:text-(--color-success) transition-colors cursor-pointer"
            title="Reconnect"
          >
            <RefreshCw size={13} />
          </button>
        ) : (
          <button
            onClick={handleDisconnect}
            className="p-1 rounded-md hover:bg-(--color-error)/10 text-(--color-text-disabled) hover:text-(--color-error) transition-colors cursor-pointer"
            title="Disconnect"
          >
            <LogOut size={13} />
          </button>
        )}
        <button
          onClick={() => setShowUsers(!showUsers)}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors cursor-pointer ${
            showUsers
              ? 'bg-(--color-accent)/12 text-(--color-link)'
              : 'text-(--color-text-tertiary) hover:bg-white/5'
          }`}
        >
          <Users size={13} />
          {hub.counts?.user_count || users.length}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat messages */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5">
            {messages.length === 0 && (
              <p className="text-caption text-center py-8">No messages yet</p>
            )}
            {messages.map((msg) => (
              msg.type === 'log' ? (
                <div key={msg.id} className="flex gap-2 py-0.5">
                  <span className="text-[11px] shrink-0 opacity-40 pt-0.5 tabular-nums font-mono">
                    {new Date(msg.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`text-xs italic ${
                    msg.severity === 'error' ? 'text-(--color-error)' :
                    msg.severity === 'warning' ? 'text-(--color-warning)' :
                    'text-(--color-text-disabled)'
                  }`}>
                    *** {msg.text}
                  </span>
                </div>
              ) : (
                <div key={msg.id} className={`flex gap-2 py-0.5 ${msg.third_person ? 'italic' : ''}`}>
                  <span className="text-[11px] shrink-0 opacity-40 pt-0.5 tabular-nums font-mono">
                    {new Date(msg.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-xs font-semibold text-(--color-link) shrink-0 cursor-pointer hover:underline">
                    {msg.from?.nick || '???'}
                  </span>
                  <span className="text-xs text-(--color-text-secondary) break-words min-w-0">
                    {msg.text}
                  </span>
                </div>
              )
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
          <div className="w-56 border-l border-(--color-glass-border) flex flex-col overflow-hidden">
            {/* User search */}
            <div className="p-2 border-b border-(--color-glass-border)/50">
              <input
                type="text"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Filter users..."
                className="w-full h-7 px-2 rounded bg-(--color-surface-3) border border-(--color-glass-border) text-xs text-(--color-text-primary) placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) transition-colors"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-1">
              <span className="text-micro block px-2 py-1 font-medium">
                {onlineCount} online / {users.length} total
              </span>
              {filteredUsers.map((user) => {
                const isOnline = !user.flags.includes('offline')
                const isBot = user.flags.includes('bot') || user.flags.includes('hidden')
                return (
                <div
                  key={user.cid}
                  className={`group px-2 py-1 text-xs flex items-center gap-1.5 hover:bg-white/3 rounded cursor-default ${
                    isOnline ? 'text-(--color-text-secondary)' : 'text-(--color-text-disabled)'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    isOnline ? 'bg-(--color-success)' : 'bg-(--color-text-disabled)'
                  }`} />
                  <span className={`truncate flex-1 ${isBot ? 'italic' : ''}`}>{user.nick}</span>
                  <span className="text-micro shrink-0 hidden group-hover:inline">
                    {formatBytes(user.share_size)}
                  </span>
                  <button
                    onClick={() => handleBrowseUser(user)}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-(--color-accent)/10 text-(--color-link) transition-all cursor-pointer"
                    title="Browse filelist"
                  >
                    <FileSearch size={12} />
                  </button>
                </div>
              )})}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
