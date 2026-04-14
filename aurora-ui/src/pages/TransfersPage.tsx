import { useEffect } from 'react'
import { useTransferStore } from '@/stores/transferStore'
import { formatBytes, formatSpeed } from '@/lib/utils'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
} from 'lucide-react'

export function TransfersPage() {
  const { transfers, stats, fetchTransfers } = useTransferStore()

  useEffect(() => {
    fetchTransfers()
    const interval = setInterval(fetchTransfers, 2000)
    return () => clearInterval(interval)
  }, [fetchTransfers])

  const downloads = transfers.filter((t) => t.download)
  const uploads = transfers.filter((t) => !t.download)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-heading text-2xl text-(--color-text-primary)">Transfers</h1>

      {/* Summary */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Download" value={formatSpeed(stats.speed_down)} color="text-(--color-success)" />
          <MiniStat label="Upload" value={formatSpeed(stats.speed_up)} color="text-(--color-link)" />
          <MiniStat label="Session Down" value={formatBytes(stats.session_down)} />
          <MiniStat label="Session Up" value={formatBytes(stats.session_up)} />
        </div>
      )}

      {/* Downloads */}
      <TransferSection
        title="Downloads"
        icon={ArrowDownToLine}
        transfers={downloads}
        color="text-(--color-success)"
      />

      {/* Uploads */}
      <TransferSection
        title="Uploads"
        icon={ArrowUpFromLine}
        transfers={uploads}
        color="text-(--color-link)"
      />

      {transfers.length === 0 && (
        <div className="text-center py-16">
          <ArrowLeftRight size={32} className="mx-auto text-(--color-text-disabled) mb-3" />
          <p className="text-caption">No active transfers</p>
        </div>
      )}
    </div>
  )
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="rounded-lg bg-(--color-surface-2) px-3 py-2.5">
      <span className="text-micro block mb-0.5">{label}</span>
      <span className={`text-sm font-semibold ${color || 'text-(--color-text-primary)'}`}>
        {value}
      </span>
    </div>
  )
}

function TransferSection({
  title,
  icon: Icon,
  transfers,
  color,
}: {
  title: string
  icon: React.ElementType
  transfers: ReturnType<typeof useTransferStore.getState>['transfers']
  color: string
}) {
  if (transfers.length === 0) return null

  return (
    <div className="rounded-xl bg-(--color-surface-2) overflow-hidden">
      <div className="px-4 py-2.5 border-b border-(--color-glass-border) flex items-center gap-2">
        <Icon size={15} className={color} />
        <span className="text-sm font-medium text-(--color-text-primary)">{title}</span>
        <span className="text-micro ml-auto">{transfers.length}</span>
      </div>
      <div className="divide-y divide-(--color-glass-border)">
        {transfers.map((t) => {
          const progress =
            t.size > 0 ? (t.bytes_transferred / t.size) * 100 : 0
          return (
            <div key={t.id} className="px-4 py-2.5 space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="text-sm text-(--color-text-primary) truncate flex-1">
                  {t.name}
                </span>
                <span className="text-micro shrink-0">{t.user.nick}</span>
                <span className="text-micro shrink-0">
                  {formatBytes(t.bytes_transferred)} / {formatBytes(t.size)}
                </span>
                {t.speed > 0 && (
                  <span className={`text-micro shrink-0 ${color}`}>
                    {formatSpeed(t.speed)}
                  </span>
                )}
              </div>
              <div className="h-0.5 rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-(--color-accent) transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
