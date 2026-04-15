import { Socket } from 'airdcpp-apisocket'
import type { APISocket } from 'airdcpp-apisocket'

let socketInstance: APISocket | null = null

const DAEMON_PORT = 5600

function getWsUrl(): string {
  // In Tauri (production), window.location is tauri://localhost — need explicit daemon port
  // In dev mode with Vite proxy, use the dev server host
  const isTauri = window.location.protocol === 'tauri:' ||
                  window.location.protocol === 'https:' && window.location.port === ''

  if (isTauri || !window.location.port) {
    return `ws://127.0.0.1:${DAEMON_PORT}/api/v1/`
  }

  // Dev mode: go through Vite proxy
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/api/v1/`
}

export function getSocket(): APISocket | null {
  return socketInstance
}

export function createSocket(): APISocket {
  if (socketInstance) return socketInstance

  socketInstance = Socket(
    {
      url: getWsUrl(),
      autoReconnect: true,
      reconnectInterval: 5,
      logLevel: import.meta.env.DEV ? 'verbose' : 'warn',
    },
    WebSocket as unknown as WebSocket,
  )

  return socketInstance
}

export function destroySocket(): void {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}

export type { APISocket }
