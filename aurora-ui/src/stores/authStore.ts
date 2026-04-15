import { create } from 'zustand'
import { createSocket, destroySocket, getSocket } from '@/api/socket'

const TOKEN_KEY = 'aurora_refresh_token'
const USERNAME_KEY = 'aurora_username'

interface AuthState {
  isAuthenticated: boolean
  isConnecting: boolean
  username: string | null
  error: string | null
  systemInfo: SystemInfo | null

  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  tryReconnect: () => Promise<boolean>
}

interface SystemInfo {
  client_version: string
  hostname: string
  platform: string
  system_info: string
  client_started: number
}

interface ConnectResponse {
  refresh_token?: string
  auth_token?: string
}

function setupSocket(set: (partial: Partial<AuthState>) => void) {
  const socket = createSocket()
  socket.onDisconnected = (reason, _code, _wasClean) => {
    set({ isAuthenticated: false, error: reason || 'Disconnected' })
  }
  return socket
}

async function fetchSystemInfo(set: (partial: Partial<AuthState>) => void) {
  const socket = getSocket()
  if (!socket) return
  try {
    const info = (await socket.get('system/system_info')) as SystemInfo
    set({ systemInfo: info })
  } catch {
    // Non-critical
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isConnecting: false,
  username: null,
  error: null,
  systemInfo: null,

  login: async (username: string, password: string) => {
    set({ isConnecting: true, error: null })
    try {
      const socket = setupSocket(set)
      const result = (await socket.connect(username, password)) as ConnectResponse

      // Persist session
      if (result?.refresh_token) {
        localStorage.setItem(TOKEN_KEY, result.refresh_token)
      }
      localStorage.setItem(USERNAME_KEY, username)

      set({ isAuthenticated: true, isConnecting: false, username })
      fetchSystemInfo(set)
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
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USERNAME_KEY)
    set({
      isAuthenticated: false,
      isConnecting: false,
      username: null,
      systemInfo: null,
      error: null,
    })
  },

  tryReconnect: async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem(TOKEN_KEY)
    const savedUsername = localStorage.getItem(USERNAME_KEY)
    if (!refreshToken) return false

    set({ isConnecting: true, error: null })

    // Retry up to 3 times with backoff (helps with proxy/startup timing)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt > 0) {
          destroySocket()
          await new Promise((r) => setTimeout(r, 500 * attempt))
        }
        const socket = setupSocket(set)
        const result = (await socket.connectRefreshToken(refreshToken)) as ConnectResponse

        if (result?.refresh_token) {
          localStorage.setItem(TOKEN_KEY, result.refresh_token)
        }

        set({
          isAuthenticated: true,
          isConnecting: false,
          username: savedUsername,
        })
        fetchSystemInfo(set)
        return true
      } catch {
        // Retry on next iteration
      }
    }

    // All retries failed
    localStorage.removeItem(TOKEN_KEY)
    destroySocket()
    set({ isConnecting: false })
    return false
  },
}))
