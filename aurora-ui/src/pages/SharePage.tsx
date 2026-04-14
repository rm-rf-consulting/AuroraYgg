import { useEffect, useState } from 'react'
import { getSocket } from '@/api/socket'
import { formatBytes } from '@/lib/utils'
import { FolderOpen, Plus, Trash2, RefreshCw } from 'lucide-react'

interface ShareRoot {
  id: number
  virtual_name: string
  path: string
  incoming: boolean
  profiles: {
    id: number
    str: string
  }[]
  type: {
    id: string
    str: string
  }
  size: number
  status: {
    id: string
    str: string
  }
  last_refresh_time: number
}

export function SharePage() {
  const [roots, setRoots] = useState<ShareRoot[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRoots = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const data = (await socket.get('share_roots')) as ShareRoot[]
      setRoots(data)
    } catch (err) {
      console.error('Failed to fetch share roots:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoots()
  }, [])

  const handleRefresh = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post('share/refresh')
    } catch {}
  }

  const handleRemoveRoot = async (rootId: number) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.delete(`share_roots/${rootId}`)
      setRoots((prev) => prev.filter((r) => r.id !== rootId))
    } catch {}
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading text-2xl text-(--color-text-primary)">Share</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-4) text-(--color-text-secondary) text-xs transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-caption text-center py-12">Loading...</p>
      ) : roots.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen size={32} className="mx-auto text-(--color-text-disabled) mb-3" />
          <p className="text-caption">No shared directories</p>
        </div>
      ) : (
        <div className="space-y-2">
          {roots.map((root) => (
            <div
              key={root.id}
              className="rounded-xl bg-(--color-surface-2) p-4 flex items-center gap-4"
            >
              <FolderOpen size={20} className="text-(--color-warning) shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-(--color-text-primary) font-medium">
                  {root.virtual_name}
                </p>
                <p className="text-micro truncate">{root.path}</p>
              </div>
              <span className="text-micro shrink-0">{formatBytes(root.size)}</span>
              <span className="text-micro shrink-0">{root.status.str}</span>
              {root.incoming && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-success)/10 text-(--color-success)">
                  Incoming
                </span>
              )}
              <button
                onClick={() => handleRemoveRoot(root.id)}
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
