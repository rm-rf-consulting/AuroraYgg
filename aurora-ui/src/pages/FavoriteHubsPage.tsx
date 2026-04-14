import { useEffect, useState } from 'react'
import { getSocket } from '@/api/socket'
import { Heart, Plug, Trash2 } from 'lucide-react'

interface FavoriteHub {
  id: number
  name: string
  hub_url: string
  auto_connect: boolean
  share_profile: {
    id: number
    str: string
  }
  nick: string
  user_description: string
  connect_state?: {
    id: string
    str: string
  }
  current_hub_id?: number
}

export function FavoriteHubsPage() {
  const [favorites, setFavorites] = useState<FavoriteHub[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFavorites = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const data = (await socket.get('favorite_hubs')) as FavoriteHub[]
      setFavorites(data)
    } catch {
      // Ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFavorites()
  }, [])

  const handleConnect = async (hub: FavoriteHub) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post('hubs', { hub_url: hub.hub_url })
    } catch {}
  }

  const handleRemove = async (hubId: number) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.delete(`favorite_hubs/${hubId}`)
      setFavorites((prev) => prev.filter((h) => h.id !== hubId))
    } catch {}
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-heading text-2xl text-(--color-text-primary)">Favorite Hubs</h1>

      {loading ? (
        <p className="text-caption text-center py-12">Loading...</p>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={32} className="mx-auto text-(--color-text-disabled) mb-3" />
          <p className="text-caption">No favorite hubs</p>
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((hub) => (
            <div
              key={hub.id}
              className="rounded-xl bg-(--color-surface-2) p-4 flex items-center gap-4"
            >
              <Heart
                size={16}
                className={
                  hub.current_hub_id
                    ? 'text-(--color-accent) fill-(--color-accent)'
                    : 'text-(--color-text-tertiary)'
                }
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-(--color-text-primary) font-medium">
                  {hub.name || hub.hub_url}
                </p>
                <p className="text-micro truncate">{hub.hub_url}</p>
              </div>
              {hub.auto_connect && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-accent)/10 text-(--color-link)">
                  Auto
                </span>
              )}
              {hub.connect_state && (
                <span className="text-micro">{hub.connect_state.str}</span>
              )}
              <button
                onClick={() => handleConnect(hub)}
                disabled={!!hub.current_hub_id}
                className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-tertiary) hover:text-(--color-success) transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Connect"
              >
                <Plug size={14} />
              </button>
              <button
                onClick={() => handleRemove(hub.id)}
                className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-tertiary) hover:text-(--color-error) transition-colors cursor-pointer"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
