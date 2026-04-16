import { create } from 'zustand'
import { getSocket } from '@/api/socket'

export interface Hub {
  id: number
  identity: {
    name: string
    description: string
  }
  hub_url: string
  connect_state: {
    id: string
    str: string
  }
  encryption?: {
    str: string
    trusted: boolean
  } | null
  share_profile?: {
    id: number
    str: string
  }
  counts?: {
    user_count: number
    share_size: number
  }
  message_counts?: {
    total: number
    unread: {
      messages: number
      status: number
      bot: number
      user: number
      mention: number
    }
  }
}

// API returns messages in two formats
export interface HubMessage {
  id: number
  text: string
  time: number
  severity?: string  // for log messages
  type: 'chat' | 'log'
  from?: {
    cid: string
    nick: string
    flags: string[]
  }
  third_person?: boolean
}

interface RawHubMessage {
  chat_message?: {
    from: {
      cid: string
      nick: string
      flags: string[]
    }
    text: string
    time: number
    id: number
    has_mention: boolean
    third_person: boolean
  }
  log_message?: {
    id: number
    text: string
    time: number
    severity: string
    type: string
  }
}

function parseMessage(raw: RawHubMessage): HubMessage {
  if (raw.chat_message) {
    const cm = raw.chat_message
    return {
      id: cm.id,
      text: cm.text,
      time: cm.time,
      type: 'chat',
      from: {
        cid: cm.from.cid,
        nick: cm.from.nick.trim(),
        flags: cm.from.flags,
      },
      third_person: cm.third_person,
    }
  }
  if (raw.log_message) {
    const lm = raw.log_message
    return {
      id: lm.id,
      text: lm.text,
      time: lm.time,
      type: 'log',
      severity: lm.severity,
    }
  }
  // Fallback
  return { id: 0, text: '', time: 0, type: 'log' }
}

interface HubState {
  hubs: Hub[]
  activeHubId: number | null
  messages: Record<number, HubMessage[]>
  loading: boolean

  fetchHubs: () => Promise<void>
  setActiveHub: (id: number | null) => void
  fetchMessages: (hubId: number) => Promise<void>
  sendMessage: (hubId: number, text: string) => Promise<void>
  disconnectHub: (hubId: number) => Promise<void>
  reconnectHub: (hubId: number) => Promise<void>
  subscribeToHubEvents: () => Promise<(() => void) | undefined>
}

export const useHubStore = create<HubState>((set, get) => ({
  hubs: [],
  activeHubId: null,
  messages: {},
  loading: false,

  fetchHubs: async () => {
    const socket = getSocket()
    if (!socket) return
    set({ loading: true })
    try {
      const hubs = (await socket.get('hubs')) as Hub[]
      set({ hubs, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  setActiveHub: (id) => set({ activeHubId: id }),

  fetchMessages: async (hubId: number) => {
    const socket = getSocket()
    if (!socket) return
    try {
      const rawMsgs = (await socket.get(`hubs/${hubId}/messages/100`)) as RawHubMessage[]
      const msgs = rawMsgs.map(parseMessage).filter((m) => m.id > 0)
      set((state) => ({
        messages: { ...state.messages, [hubId]: msgs },
      }))
    } catch {
      // Ignore — hub might be disconnected
    }
  },

  sendMessage: async (hubId: number, text: string) => {
    const socket = getSocket()
    if (!socket) return
    await socket.post(`hubs/${hubId}/chat_message`, { text })
  },

  disconnectHub: async (hubId: number) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`hubs/${hubId}/disconnect`)
    } catch {}
  },

  reconnectHub: async (hubId: number) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`hubs/${hubId}/reconnect`)
    } catch {}
  },

  subscribeToHubEvents: async () => {
    const socket = getSocket()
    if (!socket) return

    const removers: (() => void)[] = []

    const r1 = await socket.addListener('hubs', 'hub_added', (hub: Hub) => {
      set((state) => ({ hubs: [...state.hubs, hub] }))
    })
    removers.push(r1)

    const r2 = await socket.addListener('hubs', 'hub_removed', (hub: Hub) => {
      set((state) => ({
        hubs: state.hubs.filter((h) => h.id !== hub.id),
      }))
    })
    removers.push(r2)

    const r3 = await socket.addListener('hubs', 'hub_updated', (hub: Hub) => {
      set((state) => ({
        hubs: state.hubs.map((h) => (h.id === hub.id ? { ...h, ...hub } : h)),
      }))
    })
    removers.push(r3)

    return () => removers.forEach((r) => r())
  },
}))
