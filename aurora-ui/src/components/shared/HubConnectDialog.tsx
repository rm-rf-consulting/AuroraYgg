import { useState, type FormEvent } from 'react'
import { getSocket } from '@/api/socket'
import { toast } from '@/components/shared/Toast'
import { X, Plug } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export function HubConnectDialog({ open, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [connecting, setConnecting] = useState(false)

  if (!open) return null

  const handleConnect = async (e: FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    const socket = getSocket()
    if (!socket) return

    setConnecting(true)
    try {
      await socket.post('hubs', { hub_url: url.trim() })
      toast.success(`Connecting to ${url.trim()}`)
      setUrl('')
      onClose()
    } catch (err) {
      toast.error(`Failed to connect: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setConnecting(false)
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-(--z-modal-backdrop) backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed top-[25%] left-1/2 -translate-x-1/2 w-full max-w-md z-(--z-modal) px-4">
        <div className="rounded-2xl bg-(--color-surface-2) border border-(--color-glass-border) shadow-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-(--color-text-primary)">
              Connect to Hub
            </h2>
            <button
              onClick={onClose}
              className="text-(--color-text-tertiary) hover:text-(--color-text-primary) cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleConnect} className="space-y-3">
            <div>
              <label className="text-micro block mb-1.5">Hub Address</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="adc://hub.example.com:1511 or adcs://..."
                autoFocus
                className="w-full h-10 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-accent) transition-colors font-mono"
              />
              <p className="text-micro mt-1.5">
                Supports ADC, ADCS, NMDC, NMDCS protocols
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs text-(--color-text-secondary) hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={connecting || !url.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              >
                <Plug size={13} />
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
