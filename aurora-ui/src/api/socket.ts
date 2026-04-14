import { Socket } from 'airdcpp-apisocket'
import type { APISocket } from 'airdcpp-apisocket'

let socketInstance: APISocket | null = null

function getWsUrl(): string {
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
