import { useEffect, useState } from 'react'
import {
  fetchPublicPeers,
  type PeerRegion,
  type Peer,
} from '@/services/peerParser'
import {
  Globe,
  ChevronDown,
  ChevronRight,
  Shield,
  Wifi,
  WifiOff,
  Check,
  Loader2,
  RefreshCw,
  MapPin,
} from 'lucide-react'

interface YggStatus {
  running: boolean
  address?: string
}

const PROTOCOL_COLORS: Record<string, string> = {
  tls: 'bg-emerald-500/15 text-emerald-400',
  tcp: 'bg-blue-500/15 text-blue-400',
  quic: 'bg-purple-500/15 text-purple-400',
  ws: 'bg-amber-500/15 text-amber-400',
  socks: 'bg-gray-500/15 text-gray-400',
}

export function PeersPage() {
  const [regions, setRegions] = useState<PeerRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPeers, setSelectedPeers] = useState<Set<string>>(new Set())
  const [activePeers, setActivePeers] = useState<string[]>([])
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set(['europe']))
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set())
  const [yggStatus, setYggStatus] = useState<YggStatus | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyResult, setApplyResult] = useState<string | null>(null)

  // Fetch status and active peers
  useEffect(() => {
    fetch('/api/ygg/status')
      .then((r) => r.json())
      .then((data) => setYggStatus(data))
      .catch(() => {})

    fetch('/api/ygg/active-peers')
      .then((r) => r.json())
      .then((data) => {
        if (data.peers) {
          setActivePeers(data.peers)
          setSelectedPeers(new Set(data.peers))
        }
      })
      .catch(() => {})
  }, [])

  // Fetch public peers from GitHub
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchPublicPeers()
      .then((data) => {
        setRegions(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const togglePeer = (uri: string) => {
    setSelectedPeers((prev) => {
      const next = new Set(prev)
      if (next.has(uri)) next.delete(uri)
      else next.add(uri)
      return next
    })
    setApplyResult(null)
  }

  const toggleAllCountry = (peers: Peer[]) => {
    setSelectedPeers((prev) => {
      const next = new Set(prev)
      const allSelected = peers.every((p) => next.has(p.uri))
      if (allSelected) {
        peers.forEach((p) => next.delete(p.uri))
      } else {
        peers.forEach((p) => next.add(p.uri))
      }
      return next
    })
    setApplyResult(null)
  }

  const toggleRegion = (slug: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const toggleCountry = (key: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectOnlyTls = () => {
    const tlsPeers = new Set<string>()
    for (const region of regions) {
      for (const country of region.countries) {
        for (const peer of country.peers) {
          if (peer.protocol === 'tls') tlsPeers.add(peer.uri)
        }
      }
    }
    setSelectedPeers(tlsPeers)
    setApplyResult(null)
  }

  const applyPeers = async () => {
    setApplying(true)
    setApplyResult(null)
    try {
      const res = await fetch('/api/ygg/apply-peers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peers: Array.from(selectedPeers) }),
      })
      const data = await res.json()
      if (data.success) {
        setActivePeers(Array.from(selectedPeers))
        setApplyResult(
          `Applied ${data.peersCount} peers.${data.restarted ? ' Yggdrasil restarted.' : ' Restart manually to take effect.'}`
        )
        // Refresh status
        fetch('/api/ygg/status')
          .then((r) => r.json())
          .then((d) => setYggStatus(d))
          .catch(() => {})
      } else {
        setApplyResult(`Error: ${data.error}`)
      }
    } catch (err) {
      setApplyResult(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setApplying(false)
  }

  const totalAvailable = regions.reduce((s, r) => s + r.totalPeers, 0)
  const hasChanges =
    selectedPeers.size !== activePeers.length ||
    !activePeers.every((p) => selectedPeers.has(p))

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-heading text-2xl text-(--color-text-primary)">
            Yggdrasil Peers
          </h1>
          <p className="text-caption mt-1">
            Public peers from{' '}
            <a
              href="https://github.com/yggdrasil-network/public-peers"
              target="_blank"
              rel="noopener"
              className="text-(--color-link) hover:underline"
            >
              yggdrasil-network/public-peers
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {yggStatus && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs ${
                yggStatus.running
                  ? 'bg-(--color-success)/10 text-(--color-success)'
                  : 'bg-(--color-error)/10 text-(--color-error)'
              }`}
            >
              {yggStatus.running ? <Wifi size={13} /> : <WifiOff size={13} />}
              {yggStatus.running ? 'Running' : 'Stopped'}
            </div>
          )}
        </div>
      </div>

      {/* Yggdrasil address */}
      {yggStatus?.address && (
        <div className="rounded-xl bg-(--color-surface-2) p-4 flex items-center gap-3">
          <Globe size={18} className="text-(--color-accent) shrink-0" />
          <div className="min-w-0">
            <span className="text-micro block">Your Yggdrasil Address</span>
            <span className="text-sm text-(--color-text-primary) font-mono">
              {yggStatus.address}
            </span>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-(--color-text-secondary)">
          {selectedPeers.size} selected of {totalAvailable} available
        </span>
        <button
          onClick={selectOnlyTls}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-4) text-xs text-(--color-text-secondary) transition-colors cursor-pointer"
        >
          <Shield size={12} />
          Select TLS only
        </button>
        <button
          onClick={() => setSelectedPeers(new Set())}
          className="px-3 py-1.5 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-4) text-xs text-(--color-text-secondary) transition-colors cursor-pointer"
        >
          Clear all
        </button>
        <div className="flex-1" />
        {applyResult && (
          <span
            className={`text-xs ${
              applyResult.startsWith('Error') || applyResult.startsWith('Failed')
                ? 'text-(--color-error)'
                : 'text-(--color-success)'
            }`}
          >
            {applyResult}
          </span>
        )}
        <button
          onClick={applyPeers}
          disabled={applying || selectedPeers.size === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          {applying ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Check size={13} />
          )}
          {applying ? 'Applying...' : hasChanges ? 'Apply & Restart' : 'Applied'}
        </button>
      </div>

      {/* Peer list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 size={20} className="animate-spin text-(--color-text-tertiary)" />
          <span className="text-caption">Fetching peers from GitHub...</span>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-(--color-error)">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-3 py-1.5 rounded-lg bg-(--color-surface-3) text-xs text-(--color-text-secondary) cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {regions.map((region) => (
            <div key={region.slug} className="rounded-xl bg-(--color-surface-2) overflow-hidden">
              {/* Region header */}
              <button
                onClick={() => toggleRegion(region.slug)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors cursor-pointer text-left"
              >
                {expandedRegions.has(region.slug) ? (
                  <ChevronDown size={15} className="text-(--color-text-tertiary) shrink-0" />
                ) : (
                  <ChevronRight size={15} className="text-(--color-text-tertiary) shrink-0" />
                )}
                <Globe size={15} className="text-(--color-accent) shrink-0" />
                <span className="text-sm font-medium text-(--color-text-primary) flex-1">
                  {region.name}
                </span>
                <span className="text-micro">
                  {region.countries.length} countries &middot; {region.totalPeers} peers
                </span>
              </button>

              {/* Countries */}
              {expandedRegions.has(region.slug) && (
                <div className="border-t border-(--color-glass-border)">
                  {region.countries.map((country) => {
                    const countryKey = `${region.slug}/${country.slug}`
                    const isExpanded = expandedCountries.has(countryKey)
                    const allSelected = country.peers.every((p) =>
                      selectedPeers.has(p.uri)
                    )
                    const someSelected = country.peers.some((p) =>
                      selectedPeers.has(p.uri)
                    )

                    return (
                      <div key={countryKey}>
                        <div className="flex items-center gap-2 px-4 py-2 hover:bg-white/2 border-t border-(--color-glass-border)/50">
                          {/* Checkbox for whole country */}
                          <button
                            onClick={() => toggleAllCountry(country.peers)}
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                              allSelected
                                ? 'bg-(--color-accent) border-(--color-accent)'
                                : someSelected
                                  ? 'bg-(--color-accent)/30 border-(--color-accent)'
                                  : 'border-(--color-text-disabled) hover:border-(--color-text-tertiary)'
                            }`}
                          >
                            {(allSelected || someSelected) && (
                              <Check size={10} className="text-white" />
                            )}
                          </button>

                          <button
                            onClick={() => toggleCountry(countryKey)}
                            className="flex items-center gap-2 flex-1 cursor-pointer text-left"
                          >
                            <MapPin size={13} className="text-(--color-text-tertiary)" />
                            <span className="text-xs text-(--color-text-secondary)">
                              {country.name}
                            </span>
                            <span className="text-micro ml-auto">
                              {country.peers.filter((p) => selectedPeers.has(p.uri)).length}/
                              {country.peers.length}
                            </span>
                            {isExpanded ? (
                              <ChevronDown size={12} className="text-(--color-text-disabled)" />
                            ) : (
                              <ChevronRight size={12} className="text-(--color-text-disabled)" />
                            )}
                          </button>
                        </div>

                        {/* Individual peers */}
                        {isExpanded && (
                          <div className="pl-10 pr-4 pb-2 space-y-1">
                            {country.peers.map((peer) => {
                              const isSelected = selectedPeers.has(peer.uri)
                              const isActive = activePeers.includes(peer.uri)
                              return (
                                <div
                                  key={peer.uri}
                                  onClick={() => togglePeer(peer.uri)}
                                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                                    isSelected
                                      ? 'bg-(--color-accent)/8'
                                      : 'hover:bg-white/3'
                                  }`}
                                >
                                  <div
                                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                      isSelected
                                        ? 'bg-(--color-accent) border-(--color-accent)'
                                        : 'border-(--color-text-disabled)'
                                    }`}
                                  >
                                    {isSelected && (
                                      <Check size={9} className="text-white" />
                                    )}
                                  </div>
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                      PROTOCOL_COLORS[peer.protocol] || 'bg-white/5 text-(--color-text-tertiary)'
                                    }`}
                                  >
                                    {peer.protocol.toUpperCase()}
                                  </span>
                                  <span className="text-xs text-(--color-text-secondary) font-mono truncate flex-1">
                                    {peer.host}:{peer.port}
                                  </span>
                                  {isActive && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-success)/10 text-(--color-success)">
                                      active
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                            {country.peers[0]?.description && (
                              <p className="text-micro pl-6 pt-1 italic">
                                {country.peers[0].description}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
