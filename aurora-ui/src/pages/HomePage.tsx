import { useEffect, useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useHubStore } from '@/stores/hubStore'
import { useTransferStore } from '@/stores/transferStore'
import { formatBytes, formatSpeed } from '@/lib/utils'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Radio,
  Users,
  HardDrive,
  Activity,
} from 'lucide-react'
import { getSocket } from '@/api/socket'

interface ShareStats {
  total_size: number
  total_file_count: number
}

export function HomePage() {
  const systemInfo = useAuthStore((s) => s.systemInfo)
  const hubs = useHubStore((s) => s.hubs)
  const stats = useTransferStore((s) => s.stats)
  const transfers = useTransferStore((s) => s.transfers)
  const fetchTransfers = useTransferStore((s) => s.fetchTransfers)
  const [shareStats, setShareStats] = useState<ShareStats | null>(null)

  useEffect(() => {
    fetchTransfers()

    const socket = getSocket()
    if (socket) {
      socket.get('share/stats').then((data) => {
        if (data && typeof data === 'object') {
          setShareStats(data as ShareStats)
        }
      }).catch(() => {})
    }
  }, [fetchTransfers])

  const totalUsers = hubs.reduce(
    (sum, h) => sum + (h.counts?.user_count || 0),
    0
  )

  const activeDownloads = transfers.filter(
    (t) => t.download && t.state.id === 'running'
  ).length
  const activeUploads = transfers.filter(
    (t) => !t.download && t.state.id === 'running'
  ).length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-heading text-2xl text-(--color-text-primary)">
          Dashboard
        </h1>
        {systemInfo && (
          <p className="text-caption mt-1">
            {systemInfo.hostname} &middot; v{systemInfo.client_version}
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={ArrowDownToLine}
          label="Download"
          value={stats ? formatSpeed(stats.speed_down) : '---'}
          sub={stats ? `${formatBytes(stats.session_downloaded)} this session` : undefined}
          color="text-(--color-success)"
        />
        <StatCard
          icon={ArrowUpFromLine}
          label="Upload"
          value={stats ? formatSpeed(stats.speed_up) : '---'}
          sub={stats ? `${formatBytes(stats.session_uploaded)} this session` : undefined}
          color="text-(--color-link)"
        />
        <StatCard
          icon={Radio}
          label="Hubs"
          value={String(hubs.length)}
          sub={`${totalUsers} users online`}
          color="text-(--color-warning)"
        />
        <StatCard
          icon={HardDrive}
          label="Shared"
          value={shareStats ? formatBytes(shareStats.total_size) : '---'}
          sub={shareStats ? `${shareStats.total_file_count.toLocaleString()} files` : undefined}
          color="text-(--color-info)"
        />
      </div>

      {/* Active transfers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl bg-(--color-surface-2) p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} className="text-(--color-text-tertiary)" />
            <h2 className="text-sm font-medium text-(--color-text-primary)">
              Active Transfers
            </h2>
          </div>
          {transfers.filter((t) => t.state.id === 'running').length === 0 ? (
            <p className="text-caption text-sm">No active transfers</p>
          ) : (
            <div className="space-y-2">
              {transfers
                .filter((t) => t.state.id === 'running')
                .slice(0, 8)
                .map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    {t.download ? (
                      <ArrowDownToLine size={13} className="text-(--color-success) shrink-0" />
                    ) : (
                      <ArrowUpFromLine size={13} className="text-(--color-link) shrink-0" />
                    )}
                    <span className="text-xs text-(--color-text-secondary) truncate flex-1">
                      {t.name}
                    </span>
                    <span className="text-micro shrink-0">
                      {formatSpeed(t.speed)}
                    </span>
                    <div className="w-16 h-1 rounded-full bg-white/5 shrink-0">
                      <div
                        className="h-full rounded-full bg-(--color-accent)"
                        style={{
                          width: `${t.size > 0 ? (t.bytes_transferred / t.size) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Hubs overview */}
        <div className="rounded-xl bg-(--color-surface-2) p-4">
          <div className="flex items-center gap-2 mb-3">
            <Radio size={16} className="text-(--color-text-tertiary)" />
            <h2 className="text-sm font-medium text-(--color-text-primary)">
              Connected Hubs
            </h2>
          </div>
          {hubs.length === 0 ? (
            <p className="text-caption text-sm">No hubs connected</p>
          ) : (
            <div className="space-y-2">
              {hubs.map((hub) => (
                <div
                  key={hub.id}
                  className="flex items-center gap-3 py-1"
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      hub.connect_state?.id === 'connected'
                        ? 'bg-(--color-success)'
                        : hub.connect_state?.id === 'connecting'
                          ? 'bg-(--color-warning)'
                          : 'bg-(--color-text-disabled)'
                    }`}
                  />
                  <span className="text-xs text-(--color-text-secondary) truncate flex-1">
                    {hub.identity.name || hub.hub_url}
                  </span>
                  <span className="text-micro flex items-center gap-1">
                    <Users size={11} />
                    {hub.counts?.user_count || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="rounded-xl bg-(--color-surface-2) p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon size={15} className={color} />
        <span className="text-micro font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <span className="text-xl font-semibold text-(--color-text-primary) tracking-tight">
        {value}
      </span>
      {sub && <span className="text-micro">{sub}</span>}
    </div>
  )
}
