import { create } from 'zustand'
import { createSocket, destroySocket, getSocket } from '@/api/socket'

interface AuthState {
  isAuthenticated: boolean
  isConnecting: boolean
  username: string | null
  error: string | null
  systemInfo: SystemInfo | null

  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  tryReconnect: () => Promise<void>
}

interface SystemInfo {
  client_version: string
  hostname: string
  platform: string
  system_info: string
  client_started: number
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isConnecting: false,
  username: null,
  error: null,
  systemInfo: null,

  login: async (username: string, password: string) => {
    set({ isConnecting: true, error: null })
    try {
      const socket = createSocket()

      socket.onDisconnected = (reason, _code, _wasClean) => {
        set({ isAuthenticated: false, error: reason || 'Disconnected' })
      }

      await socket.connect(username, password)
      set({ isAuthenticated: true, isConnecting: false, username })

      // Fetch system info
      try {
        const info = await socket.get('system/system_info') as SystemInfo
        set({ systemInfo: info })
      } catch {
        // Non-critical
      }
    } catch (err) {
      destroySocket()
      const message = err instanceof Error ? err.message : 'Connection failed'
      set({ isConnecting: false, error: message })
      throw err
    }
  },

  logout: async () => {
    const socket = getSocket()
    if (socket) {
      try {
        await socket.logout()
      } catch {
        // Ignore
      }
    }
    destroySocket()
    set({
      isAuthenticated: false,
      isConnecting: false,
      username: null,
      systemInfo: null,
      error: null,
    })
  },

  tryReconnect: async () => {
    const refreshToken = localStorage.getItem('aurora_refresh_token')
    if (!refreshToken) return

    set({ isConnecting: true })
    try {
      const socket = createSocket()
      socket.onDisconnected = (reason) => {
        set({ isAuthenticated: false, error: reason || 'Disconnected' })
      }
      await socket.connectRefreshToken(refreshToken)
      set({ isAuthenticated: true, isConnecting: false })
    } catch {
      localStorage.removeItem('aurora_refresh_token')
      destroySocket()
      set({ isConnecting: false })
    }
  },
}))
