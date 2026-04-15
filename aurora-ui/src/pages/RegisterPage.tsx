import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Loader2, CheckCircle, AlertCircle, UserPlus } from 'lucide-react'

export function RegisterPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [inviteCode, setInviteCode] = useState(searchParams.get('invite') || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [validating, setValidating] = useState(false)
  const [inviteValid, setInviteValid] = useState<boolean | null>(null)

  // Validate invite code on mount if provided
  useEffect(() => {
    const code = searchParams.get('invite')
    if (code) {
      setInviteCode(code)
      validateCode(code)
    }
  }, [searchParams])

  const validateCode = async (code: string) => {
    if (!code.trim()) return
    setValidating(true)
    try {
      // Try to validate against the API — for now just check format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      setInviteValid(uuidRegex.test(code.trim()))
    } catch {
      setInviteValid(false)
    }
    setValidating(false)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!inviteCode.trim()) {
      setErrorMessage('Invite code is required')
      return
    }
    if (!username.trim()) {
      setErrorMessage('Username is required')
      return
    }
    if (username.trim().length < 3) {
      setErrorMessage('Username must be at least 3 characters')
      return
    }
    if (!password) {
      setErrorMessage('Password is required')
      return
    }
    if (password.length < 4) {
      setErrorMessage('Password must be at least 4 characters')
      return
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match')
      return
    }

    setStatus('loading')
    try {
      const res = await fetch('/api/v1/web_users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invite_code: inviteCode.trim(),
          username: username.trim(),
          password,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setStatus('success')
        // Redirect to login after 2 seconds
        setTimeout(() => navigate('/login'), 2000)
      } else {
        setStatus('error')
        setErrorMessage(data.message || 'Registration failed')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Could not connect to server')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-bg-primary) p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-(--color-accent)/4 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-(--color-accent) flex items-center justify-center mb-3 shadow-lg shadow-(--color-accent)/20">
            <UserPlus size={24} className="text-white" />
          </div>
          <h1 className="text-display text-xl text-(--color-text-primary)">
            Create Account
          </h1>
          <p className="text-caption mt-1">Join Aurora on Yggdrasil</p>
        </div>

        {/* Success state */}
        {status === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle size={40} className="text-(--color-success)" />
            <p className="text-sm text-(--color-text-primary) font-medium">
              Account created!
            </p>
            <p className="text-caption text-sm">
              Redirecting to login...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Invite code */}
            <div>
              <label className="text-micro block mb-1.5">Invite Code</label>
              <div className="relative">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => {
                    setInviteCode(e.target.value)
                    setInviteValid(null)
                  }}
                  onBlur={() => validateCode(inviteCode)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  required
                  className="w-full h-11 px-3.5 pr-10 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm font-mono placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) focus:ring-1 focus:ring-(--color-accent)/50 transition-colors"
                />
                {validating && (
                  <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-(--color-text-tertiary)" />
                )}
                {inviteValid === true && (
                  <CheckCircle size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-(--color-success)" />
                )}
                {inviteValid === false && (
                  <AlertCircle size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-(--color-error)" />
                )}
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="text-micro block mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                autoComplete="username"
                className="w-full h-11 px-3.5 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-accent) focus:ring-1 focus:ring-(--color-accent)/50 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-micro block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                autoComplete="new-password"
                className="w-full h-11 px-3.5 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none focus:border-(--color-accent) focus:ring-1 focus:ring-(--color-accent)/50 transition-colors"
              />
            </div>

            {/* Confirm password */}
            <div>
              <label className="text-micro block mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                autoComplete="new-password"
                className={`w-full h-11 px-3.5 rounded-lg bg-(--color-surface-3) border text-(--color-text-primary) text-sm placeholder:text-(--color-text-tertiary) focus:outline-none focus:ring-1 transition-colors ${
                  confirmPassword && password !== confirmPassword
                    ? 'border-(--color-error) focus:border-(--color-error) focus:ring-(--color-error)/50'
                    : 'border-(--color-glass-border) focus:border-(--color-accent) focus:ring-(--color-accent)/50'
                }`}
              />
            </div>

            {/* Error */}
            {errorMessage && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-(--color-error)/10 border border-(--color-error)/20">
                <AlertCircle size={14} className="text-(--color-error) shrink-0" />
                <p className="text-xs text-(--color-error)">{errorMessage}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === 'loading' || !inviteCode || !username || !password || !confirmPassword}
              className="h-11 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) active:bg-(--color-accent-active) text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        )}

        {/* Link to login */}
        <p className="text-center mt-6">
          <span className="text-micro">Already have an account? </span>
          <button
            onClick={() => navigate('/login')}
            className="text-xs text-(--color-link) hover:underline cursor-pointer"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}
