import { useEffect, useState } from 'react'
import { getSocket } from '@/api/socket'
import { formatBytes, formatSpeed, formatDuration } from '@/lib/utils'
import { toast } from '@/components/shared/Toast'
import {
  Download,
  Pause,
  Play,
  Trash2,
  Package,
  ChevronDown,
} from 'lucide-react'

interface Bundle {
  id: number
  name: string
  target: string
  size: number
  downloaded_bytes: number
  speed: number
  seconds_left: number
  status: { id: string; str: string }
  priority: { id: number; str: string }
  type: { id: string; str: string; content_type?: string }
  time_added: number
  time_finished: number
  sources: { online: number; total: number; str: string }
}

const PRIORITIES = [
  { id: 0, label: 'Paused', color: 'text-(--color-text-disabled)' },
  { id: 1, label: 'Lowest', color: 'text-(--color-text-tertiary)' },
  { id: 2, label: 'Low', color: 'text-(--color-info)' },
  { id: 3, label: 'Normal', color: 'text-(--color-text-primary)' },
  { id: 4, label: 'High', color: 'text-(--color-warning)' },
  { id: 5, label: 'Highest', color: 'text-(--color-error)' },
]

export function QueuePage() {
  const [bundles, setBundles] = useState<Bundle[]>([])
  const [loading, setLoading] = useState(true)
  const [priorityMenuId, setPriorityMenuId] = useState<number | null>(null)

  const fetchBundles = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const data = (await socket.get('queue/bundles/0/200')) as Bundle[]
      setBundles(data)
    } catch (err) {
      if (loading) toast.error('Failed to load queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBundles()
    const interval = setInterval(fetchBundles, 3000)
    return () => clearInterval(interval)
  }, [])

  const handlePriority = async (bundleId: number, priority: number) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`queue/bundles/${bundleId}/priority`, { priority })
      setBundles((prev) =>
        prev.map((b) =>
          b.id === bundleId
            ? { ...b, priority: { id: priority, str: PRIORITIES.find((p) => p.id === priority)?.label || '' } }
            : b
        )
      )
      setPriorityMenuId(null)
    } catch {
      toast.error('Failed to change priority')
    }
  }

  const handleRemove = async (bundleId: number, name: string) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`queue/bundles/${bundleId}/remove`)
      setBundles((prev) => prev.filter((b) => b.id !== bundleId))
      toast.success(`Removed: ${name}`)
    } catch {
      toast.error('Failed to remove bundle')
    }
  }

  const handleRemoveCompleted = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post('queue/bundles/remove_completed')
      toast.success('Completed bundles removed')
      fetchBundles()
    } catch {
      toast.error('Failed to remove completed')
    }
  }

  const completedCount = bundles.filter((b) => b.status.id === 'completed').length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-2xl text-(--color-text-primary)">Queue</h1>
          <p className="text-caption mt-0.5">{bundles.length} bundles</p>
        </div>
        {completedCount > 0 && (
          <button
            onClick={handleRemoveCompleted}
            className="px-3 py-1.5 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-4) text-xs text-(--color-text-secondary) transition-colors cursor-pointer"
          >
            Remove {completedCount} completed
          </button>
        )}
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
            const progress = bundle.size > 0 ? (bundle.downloaded_bytes / bundle.size) * 100 : 0
            const isPaused = bundle.priority.id === 0
            const priorityInfo = PRIORITIES.find((p) => p.id === bundle.priority.id)

            return (
              <div key={bundle.id} className="rounded-xl bg-(--color-surface-2) p-4 space-y-2.5">
                <div className="flex items-start gap-3">
                  <Package size={16} className="text-(--color-text-tertiary) mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-(--color-text-primary) truncate">{bundle.name}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className={`text-micro ${isPaused ? 'text-(--color-warning)' : ''}`}>
                        {bundle.status.str}
                      </span>
                      <span className="text-micro">
                        {formatBytes(bundle.downloaded_bytes)} / {formatBytes(bundle.size)}
                        {progress > 0 && progress < 100 && ` (${progress.toFixed(1)}%)`}
                      </span>
                      {bundle.speed > 0 && (
                        <span className="text-micro text-(--color-success)">{formatSpeed(bundle.speed)}</span>
                      )}
                      {bundle.seconds_left > 0 && (
                        <span className="text-micro">{formatDuration(bundle.seconds_left)} left</span>
                      )}
                      <span className="text-micro">{bundle.sources.str}</span>
                    </div>
                  </div>

                  {/* Priority dropdown */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setPriorityMenuId(priorityMenuId === bundle.id ? null : bundle.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors cursor-pointer hover:bg-white/5 ${priorityInfo?.color || ''}`}
                    >
                      {priorityInfo?.label || bundle.priority.str}
                      <ChevronDown size={12} />
                    </button>
                    {priorityMenuId === bundle.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setPriorityMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1 z-20 bg-(--color-surface-3) border border-(--color-glass-border) rounded-lg shadow-lg py-1 min-w-28">
                          {PRIORITIES.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handlePriority(bundle.id, p.id)}
                              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/5 cursor-pointer transition-colors ${
                                p.id === bundle.priority.id ? 'text-(--color-link)' : p.color
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {isPaused ? (
                      <button
                        onClick={() => handlePriority(bundle.id, 3)}
                        className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-tertiary) hover:text-(--color-success) transition-colors cursor-pointer"
                        title="Resume (Normal)"
                      >
                        <Play size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePriority(bundle.id, 0)}
                        className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-tertiary) hover:text-(--color-warning) transition-colors cursor-pointer"
                        title="Pause"
                      >
                        <Pause size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(bundle.id, bundle.name)}
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
                    className={`h-full rounded-full transition-all duration-500 ${
                      isPaused ? 'bg-(--color-warning)' : 'bg-(--color-accent)'
                    }`}
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
