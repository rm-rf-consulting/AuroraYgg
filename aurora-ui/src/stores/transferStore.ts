import { create } from 'zustand'
import { getSocket } from '@/api/socket'

export interface Transfer {
  id: number
  name: string
  target: string
  type: {
    id: string
    str: string
    content_type?: string
  }
  download: boolean
  size: number
  bytes_transferred: number
  speed: number
  seconds_left: number
  user: {
    cid: string
    nick: string
    hub_url: string
    flags: string[]
  }
  state: {
    id: string
    str: string
  }
  queue_file_id?: number
  ip: string
  encryption?: string
  flags: string[]
}

export interface TransferStats {
  speed_down: number
  speed_up: number
  queued_bytes: number
  session_down: number
  session_up: number
}

interface TransferState {
  transfers: Transfer[]
  stats: TransferStats | null
  loading: boolean

  fetchTransfers: () => Promise<void>
  fetchStats: () => Promise<void>
  subscribeToTransferEvents: () => Promise<(() => void) | undefined>
}

export const useTransferStore = create<TransferState>((set) => ({
  transfers: [],
  stats: null,
  loading: false,

  fetchTransfers: async () => {
    const socket = getSocket()
    if (!socket) return
    set({ loading: true })
    try {
      const transfers = (await socket.get('transfers')) as Transfer[]
      set({ transfers, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  fetchStats: async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const stats = (await socket.get('transfers/stats')) as TransferStats
      set({ stats })
    } catch {
      // Ignore
    }
  },

  subscribeToTransferEvents: async () => {
    const socket = getSocket()
    if (!socket) return

    const removers: (() => void)[] = []

    const r1 = await socket.addListener('transfers', 'transfer_added', (transfer: Transfer) => {
      set((state) => ({ transfers: [...state.transfers, transfer] }))
    })
    removers.push(r1)

    const r2 = await socket.addListener('transfers', 'transfer_removed', (transfer: Transfer) => {
      set((state) => ({
        transfers: state.transfers.filter((t) => t.id !== transfer.id),
      }))
    })
    removers.push(r2)

    const r3 = await socket.addListener('transfers', 'transfer_updated', (transfer: Transfer) => {
      set((state) => ({
        transfers: state.transfers.map((t) =>
          t.id === transfer.id ? { ...t, ...transfer } : t
        ),
      }))
    })
    removers.push(r3)

    const r4 = await socket.addListener('transfers', 'transfer_statistics', (stats: TransferStats) => {
      set({ stats })
    })
    removers.push(r4)

    return () => removers.forEach((r) => r())
  },
}))
