import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useAuthStore } from '@/stores/authStore'
import { Loader2 } from 'lucide-react'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { login, isConnecting, error } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch {
      // Error is set in store
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-bg-primary) p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-(--color-accent)/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-(--color-accent) flex items-center justify-center mb-4 shadow-lg shadow-(--color-accent)/20">
            <span className="text-white text-2xl font-bold">A</span>
          </div>
          <h1 className="text-display text-2xl text-(--color-text-primary)">
            Aurora
          </h1>
          <p className="text-caption mt-1">DC++ for Yggdrasil</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className="w-full h-11 px-3.5 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-accent) focus:ring-1 focus:ring-(--color-accent)/50 transition-colors"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full h-11 px-3.5 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-accent) focus:ring-1 focus:ring-(--color-accent)/50 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-(--color-error) px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={isConnecting || !username || !password}
            className="h-11 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) active:bg-(--color-accent-active) text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isConnecting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Connecting...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-micro text-center mt-8">
          Connect to AirDC++ daemon at{' '}
          <span className="text-(--color-text-secondary)">{window.location.host}</span>
        </p>
      </div>
    </div>
  )
}
