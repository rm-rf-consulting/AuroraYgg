import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { toast } from '@/components/shared/Toast'
import {
  fetchPublicPeers,
  type PeerRegion,
  type Peer,
} from '@/services/peerParser'
import {
  UserPlus,
  Globe,
  Check,
  ChevronRight,
  Loader2,
  Shield,
  Wifi,
  ArrowRight,
} from 'lucide-react'

type Step = 'account' | 'peers' | 'done'

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'account', label: 'Create Account', icon: UserPlus },
  { id: 'peers', label: 'Network', icon: Globe },
  { id: 'done', label: 'Ready', icon: Check },
]

export function SetupWizard() {
  const [step, setStep] = useState<Step>('account')
  const navigate = useNavigate()

  const currentIndex = STEPS.findIndex((s) => s.id === step)

  return (
    <div className="min-h-screen flex flex-col bg-(--color-bg-primary)">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full bg-(--color-accent)/3 blur-[150px]" />
      </div>

      {/* Header */}
      <div className="relative pt-12 pb-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-(--color-accent) flex items-center justify-center mx-auto mb-4 shadow-lg shadow-(--color-accent)/20">
          <span className="text-white text-xl font-bold">A</span>
        </div>
        <h1 className="text-display text-2xl text-(--color-text-primary)">
          Welcome to Aurora
        </h1>
        <p className="text-caption mt-1">
          Let's set up your DC++ client for Yggdrasil
        </p>
      </div>

      {/* Step indicator */}
      <div className="relative flex items-center justify-center gap-2 pb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const isActive = i === currentIndex
          const isDone = i < currentIndex
          return (
            <div key={s.id} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-8 h-px ${isDone ? 'bg-(--color-accent)' : 'bg-(--color-glass-border)'}`} />
              )}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  isDone
                    ? 'bg-(--color-success) text-white'
                    : isActive
                      ? 'bg-(--color-accent) text-white'
                      : 'bg-(--color-surface-3) text-(--color-text-disabled)'
                }`}
              >
                {isDone ? <Check size={14} /> : <Icon size={14} />}
              </div>
              <span className={`text-xs hidden sm:inline ${
                isActive ? 'text-(--color-text-primary) font-medium' : 'text-(--color-text-tertiary)'
              }`}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="relative flex-1 flex items-start justify-center px-4 pb-12">
        <div className="w-full max-w-lg">
          {step === 'account' && <AccountStep onNext={() => setStep('peers')} />}
          {step === 'peers' && <PeersStep onNext={() => setStep('done')} />}
          {step === 'done' && <DoneStep onFinish={() => navigate('/login')} />}
        </div>
      </div>
    </div>
  )
}

/* Step 1: Create Admin Account */
function AccountStep({ onNext }: { onNext: () => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 4) {
      setError('Password must be at least 4 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setCreating(true)
    try {
      // Create admin user via REST API (daemon should be running from installer)
      const authRes = await fetch('/api/v1/sessions/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'password' }),
      })

      // If auth fails, the daemon has no users yet — use the web_users endpoint
      // We need to create the first user. The daemon allows this when no users exist.
      const createRes = await fetch('/api/v1/web_users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          permissions: ['admin'],
        }),
      })

      if (createRes.ok) {
        toast.success('Admin account created')
        onNext()
      } else {
        // Maybe the daemon already has a user — try to login instead
        const loginRes = await fetch('/api/v1/sessions/authorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim(), password }),
        })
        if (loginRes.ok) {
          toast.success('Logged in')
          onNext()
        } else {
          setError('Failed to create account. The daemon may already have users configured.')
        }
      }
    } catch {
      setError('Cannot connect to daemon. Make sure Aurora service is running.')
    }
    setCreating(false)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-(--color-surface-2) border border-(--color-glass-border) p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Shield size={20} className="text-(--color-accent)" />
        <h2 className="text-sm font-semibold text-(--color-text-primary)">Create Admin Account</h2>
      </div>
      <p className="text-caption text-sm">
        This will be the administrator account for your Aurora instance.
      </p>

      <div>
        <label className="text-micro block mb-1.5">Username</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full h-11 px-3.5 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm focus:outline-none focus:border-(--color-accent) transition-colors"
        />
      </div>
      <div>
        <label className="text-micro block mb-1.5">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a strong password"
          autoFocus
          className="w-full h-11 px-3.5 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-accent) transition-colors"
        />
      </div>
      <div>
        <label className="text-micro block mb-1.5">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm your password"
          className={`w-full h-11 px-3.5 rounded-lg bg-(--color-surface-3) border text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none transition-colors ${
            confirmPassword && password !== confirmPassword
              ? 'border-(--color-error)'
              : 'border-(--color-glass-border) focus:border-(--color-accent)'
          }`}
        />
      </div>

      {error && (
        <p className="text-xs text-(--color-error) px-1">{error}</p>
      )}

      <button
        type="submit"
        disabled={creating || !password || !confirmPassword}
        className="w-full h-11 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      >
        {creating ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        {creating ? 'Creating...' : 'Continue'}
      </button>
    </form>
  )
}

/* Step 2: Yggdrasil Peers */
function PeersStep({ onNext }: { onNext: () => void }) {
  const [regions, setRegions] = useState<PeerRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCount, setSelectedCount] = useState(0)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    fetchPublicPeers()
      .then((data) => {
        setRegions(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleAutoSelect = async () => {
    setApplying(true)
    try {
      // Auto-select: all European TLS peers
      const tlsPeers: string[] = []
      for (const region of regions) {
        if (region.slug === 'europe') {
          for (const country of region.countries) {
            for (const peer of country.peers) {
              if (peer.protocol === 'tls') {
                tlsPeers.push(peer.uri)
              }
            }
          }
        }
      }

      // Apply to Yggdrasil config
      const res = await fetch('/api/ygg/apply-peers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peers: tlsPeers }),
      })

      const data = await res.json()
      if (data.success) {
        setSelectedCount(tlsPeers.length)
        toast.success(`Connected to ${tlsPeers.length} European TLS peers`)
      } else {
        toast.error('Failed to apply peers. You can configure them later in Ygg Peers page.')
      }
    } catch {
      toast.info('Peer configuration skipped. You can set up peers later.')
    }
    setApplying(false)
    onNext()
  }

  const handleSkip = () => {
    toast.info('You can configure Yggdrasil peers later from the Ygg Peers page')
    onNext()
  }

  const totalPeers = regions.reduce((s, r) => s + r.totalPeers, 0)

  return (
    <div className="rounded-2xl bg-(--color-surface-2) border border-(--color-glass-border) p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Globe size={20} className="text-(--color-accent)" />
        <h2 className="text-sm font-semibold text-(--color-text-primary)">Yggdrasil Network</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 size={16} className="animate-spin text-(--color-text-tertiary)" />
          <span className="text-caption">Loading peers from GitHub...</span>
        </div>
      ) : (
        <>
          <p className="text-caption text-sm">
            Found <span className="text-(--color-text-primary) font-medium">{totalPeers} peers</span> across{' '}
            <span className="text-(--color-text-primary) font-medium">{regions.length} regions</span>.
            We'll auto-connect to European TLS peers for the best security and speed.
          </p>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-(--color-surface-3)">
            <Wifi size={16} className="text-(--color-success)" />
            <div className="flex-1">
              <span className="text-xs text-(--color-text-primary) font-medium block">
                Recommended: European TLS Peers
              </span>
              <span className="text-micro">
                Encrypted connections to {regions.find(r => r.slug === 'europe')?.countries.length || 0} countries
              </span>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSkip}
          className="flex-1 h-11 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-4) text-(--color-text-secondary) text-sm transition-colors cursor-pointer"
        >
          Skip for now
        </button>
        <button
          onClick={handleAutoSelect}
          disabled={applying || loading}
          className="flex-1 h-11 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        >
          {applying ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {applying ? 'Connecting...' : 'Connect & Continue'}
        </button>
      </div>
    </div>
  )
}

/* Step 3: Done */
function DoneStep({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="rounded-2xl bg-(--color-surface-2) border border-(--color-glass-border) p-6 space-y-5 text-center">
      <div className="w-16 h-16 rounded-full bg-(--color-success)/15 flex items-center justify-center mx-auto">
        <Check size={28} className="text-(--color-success)" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-(--color-text-primary)">
          Aurora is Ready!
        </h2>
        <p className="text-caption mt-2">
          Your DC++ client is configured and connected to the Yggdrasil mesh network.
          Sign in to start sharing files.
        </p>
      </div>

      <div className="space-y-2 text-left pt-2">
        <InfoItem label="Daemon" value="Running on port 5600" />
        <InfoItem label="Network" value="Yggdrasil (200::/7)" />
        <InfoItem label="Protocol" value="ADC / NMDC" />
      </div>

      <button
        onClick={onFinish}
        className="w-full h-11 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        Sign In
        <ArrowRight size={16} />
      </button>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-(--color-surface-3)">
      <span className="text-xs text-(--color-text-tertiary)">{label}</span>
      <span className="text-xs text-(--color-text-secondary)">{value}</span>
    </div>
  )
}
