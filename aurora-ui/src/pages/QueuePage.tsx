import { useEffect, useState } from 'react'
import { getSocket } from '@/api/socket'
import { formatBytes, formatSpeed, formatDuration } from '@/lib/utils'
import {
  Download,
  Pause,
  Play,
  Trash2,
  Package,
} from 'lucide-react'

interface Bundle {
  id: number
  name: string
  target: string
  size: number
  downloaded_bytes: number
  speed: number
  seconds_left: number
  status: {
    id: string
    str: string
  }
  priority: {
    id: number
    str: string
  }
  type: {
    id: string
    str: string
    content_type?: string
  }
  time_added: number
  time_finished: number
  sources: {
    online: number
    total: number
    str: string
  }
}

export function QueuePage() {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const fetch = async () => {
      try {
        const data = (await socket.get('queue/bundles/0?range_start=0&range_end=100')) as Bundle[]
        setBundles(data)
      } catch (err) {
        console.error('Failed to fetch queue:', err)
      } finally {
        setLoading(false)
      }
    }
    fetch()

    const interval = setInterval(fetch, 3000)
    return () => clearInterval(interval)
  }, [])

  const handlePause = async (bundleId: number) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`queue/bundles/${bundleId}/priority`, { priority: 0 })
    } catch {}
  }

  const handleResume = async (bundleId: number) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`queue/bundles/${bundleId}/priority`, { priority: 3 })
    } catch {}
  }

  const handleRemove = async (bundleId: number) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.delete(`queue/bundles/${bundleId}`)
      setBundles((prev) => prev.filter((b) => b.id !== bundleId))
    } catch {}
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading text-2xl text-(--color-text-primary)">Queue</h1>
        <span className="text-micro">{bundles.length} bundles</span>
      </div>

      {loading ? (
        <p className="text-caption text-center py-12">Loading...</p>
      ) : bundles.length === 0 ? (
        <div className="text-center py-16">
          <Download size={32} className="mx-auto text-(--color-text-disabled) mb-3" />
          <p className="text-caption">Queue is empty</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bundles.map((bundle) => {
            const progress =
              bundle.size > 0
                ? (bundle.downloaded_bytes / bundle.size) * 100
                : 0

            return (
              <div
                key={bundle.id}
                className="rounded-xl bg-(--color-surface-2) p-4 space-y-2.5"
              >
                <div className="flex items-start gap-3">
                  <Package
                    size={16}
                    className="text-(--color-text-tertiary) mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-(--color-text-primary) truncate">
                      {bundle.name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-micro">{bundle.status.str}</span>
                      <span className="text-micro">
                        {formatBytes(bundle.downloaded_bytes)} / {formatBytes(bundle.size)}
                      </span>
                      {bundle.speed > 0 && (
                        <span className="text-micro text-(--color-success)">
                          {formatSpeed(bundle.speed)}
                        </span>
                      )}
                      {bundle.seconds_left > 0 && (
                        <span className="text-micro">
                          {formatDuration(bundle.seconds_left)} left
                        </span>
                      )}
                      <span className="text-micro">{bundle.sources.str}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {bundle.priority.id === 0 ? (
                      <button
                        onClick={() => handleResume(bundle.id)}
                        className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-tertiary) hover:text-(--color-success) transition-colors cursor-pointer"
                        title="Resume"
                      >
                        <Play size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePause(bundle.id)}
                        className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-tertiary) hover:text-(--color-warning) transition-colors cursor-pointer"
                        title="Pause"
                      >
                        <Pause size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(bundle.id)}
                      className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-tertiary) hover:text-(--color-error) transition-colors cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-1 rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-(--color-accent) transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
