import { useEffect, useState } from 'react'
import { getSocket } from '@/api/socket'
import { formatBytes } from '@/lib/utils'
import { toast } from '@/components/shared/Toast'
import {
  Radio,
  RefreshCw,
  Plug,
  Users,
  HardDrive,
  Globe,
  Plus,
  Trash2,
  Loader2,
  Search,
} from 'lucide-react'

interface DiscoveredHub {
  url: string
  name: string
  description: string
  user_count: number
  share_size: number
  last_seen: number
  source: string
}

export function HubDiscoveryPage() {
  const [hubs, setHubs] = useState<DiscoveredHub[]>([])
  const [bootstrapNodes, setBootstrapNodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newBootstrap, setNewBootstrap] = useState('')

  const fetchData = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const [hubData, nodeData] = await Promise.all([
        socket.get('discovery/hubs'),
        socket.get('discovery/bootstrap'),
      ])
      setHubs(hubData as DiscoveredHub[])
      setBootstrapNodes(nodeData as string[])
    } catch {
      toast.error('Failed to load discovery data')
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleRefresh = async () => {
    const socket = getSocket()
    if (!socket) return
    setRefreshing(true)
    try {
      await socket.post('discovery/refresh')
      toast.success('Discovery refresh initiated')
      // Poll for results after a delay
      setTimeout(fetchData, 3000)
    } catch {
      toast.error('Discovery refresh failed')
    }
    setRefreshing(false)
  }

  const handleConnect = async (url: string) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post('hubs', { hub_url: url })
      toast.success(`Connecting to hub...`)
    } catch {
      toast.error('Failed to connect')
    }
  }

  const handleAddBootstrap = async () => {
    if (!newBootstrap.trim()) return
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post('discovery/bootstrap', { url: newBootstrap.trim() })
      setBootstrapNodes((prev) => [...prev, newBootstrap.trim()])
      setNewBootstrap('')
      toast.success('Bootstrap node added')
    } catch {
      toast.error('Failed to add bootstrap node')
    }
  }

  const handleRemoveBootstrap = async (url: string) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.delete(`discovery/bootstrap/${encodeURIComponent(url)}`)
      setBootstrapNodes((prev) => prev.filter((n) => n !== url))
      toast.success('Bootstrap node removed')
    } catch {
      toast.error('Failed to remove node')
    }
  }

  const SOURCE_COLORS: Record<string, string> = {
    bootstrap: 'bg-(--color-accent)/10 text-(--color-link)',
    multicast: 'bg-(--color-success)/10 text-(--color-success)',
    peer_exchange: 'bg-(--color-warning)/10 text-(--color-warning)',
    manual: 'bg-(--color-text-tertiary)/10 text-(--color-text-tertiary)',
    cached: 'bg-white/5 text-(--color-text-disabled)',
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-2xl text-(--color-text-primary)">Hub Discovery</h1>
          <p className="text-caption mt-0.5">Find DC++ hubs on the Yggdrasil network</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {refreshing ? 'Scanning...' : 'Discover Hubs'}
        </button>
      </div>

      {/* Discovered hubs */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2">
          <Loader2 size={16} className="animate-spin text-(--color-text-tertiary)" />
          <span className="text-caption">Loading...</span>
        </div>
      ) : hubs.length === 0 ? (
        <div className="text-center py-16">
          <Search size={32} className="mx-auto text-(--color-text-disabled) mb-3" />
          <p className="text-caption">No hubs discovered yet</p>
          <p className="text-micro mt-1">Click "Discover Hubs" to scan the network</p>
        </div>
      ) : (
        <div className="space-y-2">
          <span className="text-micro font-medium">{hubs.length} hubs found</span>
          {hubs.map((hub) => (
            <div key={hub.url} className="rounded-xl bg-(--color-surface-2) p-4 flex items-center gap-4">
              <Radio size={18} className="text-(--color-accent) shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-(--color-text-primary) font-medium">
                  {hub.name || hub.url}
                </p>
                {hub.description && (
                  <p className="text-micro truncate">{hub.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-micro">
                  <span className="flex items-center gap-1">
                    <Users size={10} />
                    {hub.user_count} users
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive size={10} />
                    {formatBytes(hub.share_size)}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${SOURCE_COLORS[hub.source] || ''}`}>
                    {hub.source}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleConnect(hub.url)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors cursor-pointer"
              >
                <Plug size={13} />
                Connect
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bootstrap nodes */}
      <div className="rounded-xl bg-(--color-surface-2) p-5 space-y-3">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">Bootstrap Nodes</h3>
        <p className="text-caption text-sm">
          Bootstrap nodes are queried first during discovery. Add known hub addresses or discovery servers.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={newBootstrap}
            onChange={(e) => setNewBootstrap(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddBootstrap()}
            placeholder="adc://[200:...]:1511"
            className="flex-1 h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs font-mono placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) transition-colors"
          />
          <button
            onClick={handleAddBootstrap}
            disabled={!newBootstrap.trim()}
            className="h-9 px-3 rounded-lg bg-(--color-surface-4) hover:bg-(--color-surface-5) text-(--color-text-secondary) text-xs transition-colors cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
          >
            <Plus size={13} />
            Add
          </button>
        </div>

        <div className="space-y-1">
          {bootstrapNodes.map((node) => (
            <div key={node} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-(--color-surface-3)">
              <Globe size={13} className="text-(--color-text-tertiary) shrink-0" />
              <span className="text-xs text-(--color-text-secondary) font-mono flex-1 truncate">{node}</span>
              <button
                onClick={() => handleRemoveBootstrap(node)}
                className="text-(--color-text-disabled) hover:text-(--color-error) cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
