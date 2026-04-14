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
  share_profile?: {
    id: number
    str: string
  }
  counts?: {
    user_count: number
    share_size: number
  }
  message_counts?: {
    unread: {
      messages: number
      status: number
    }
  }
}

export interface ChatMessage {
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
  third_person: boolean
}

interface HubState {
  hubs: Hub[]
  activeHubId: number | null
  messages: Record<number, ChatMessage[]>
  loading: boolean

  fetchHubs: () => Promise<void>
  setActiveHub: (id: number | null) => void
  fetchMessages: (hubId: number) => Promise<void>
  sendMessage: (hubId: number, text: string) => Promise<void>
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
      const msgs = (await socket.get(`hubs/${hubId}/messages/0`)) as ChatMessage[]
      set((state) => ({
        messages: { ...state.messages, [hubId]: msgs },
      }))
    } catch {
      // Ignore
    }
  },

  sendMessage: async (hubId: number, text: string) => {
    const socket = getSocket()
    if (!socket) return
    await socket.post(`hubs/${hubId}/chat_message`, { text })
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
