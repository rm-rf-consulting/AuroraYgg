import { useEffect, useState, type FormEvent } from 'react'
import { getSocket } from '@/api/socket'
import { toast } from '@/components/shared/Toast'
import { pickPath, isTauriAvailable } from '@/hooks/useFilePicker'
import {
  Link2,
  FolderSearch,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Clock,
  Shield,
  Users,
  Globe,
  Key,
  X,
  ExternalLink,
  Download,
} from 'lucide-react'

interface ShareLink {
  id: string
  path: string
  virtual_name: string
  created_by: string
  created_at: number
  expires_at: number
  access: 'public' | 'password' | 'invite' | 'users'
  has_password: boolean
  allowed_users: string[]
  download_count: number
  max_downloads: number
  active: boolean
  url?: string
}

const ACCESS_OPTIONS = [
  { id: 'public', label: 'Public', icon: Globe, desc: 'Anyone with the link' },
  { id: 'password', label: 'Password', icon: Key, desc: 'Requires password' },
  { id: 'users', label: 'Users Only', icon: Users, desc: 'Whitelisted users' },
]

const EXPIRY_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 1, label: '1 hour' },
  { value: 24, label: '24 hours' },
  { value: 168, label: '7 days' },
  { value: 720, label: '30 days' },
]

export function ShareLinksPage() {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  // Create form
  const [newPath, setNewPath] = useState('')
  const [newName, setNewName] = useState('')
  const [newAccess, setNewAccess] = useState<string>('public')
  const [newPassword, setNewPassword] = useState('')
  const [newExpiry, setNewExpiry] = useState(0)
  const [newMaxDownloads, setNewMaxDownloads] = useState(0)
  const [creating, setCreating] = useState(false)
  const [lastCreatedUrl, setLastCreatedUrl] = useState<string | null>(null)

  const fetchLinks = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const data = (await socket.get('share_links')) as ShareLink[]
      setLinks(data)
    } catch {
      toast.error('Failed to load share links')
    }
    setLoading(false)
  }

  useEffect(() => { fetchLinks() }, [])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newPath.trim()) return

    const socket = getSocket()
    if (!socket) return

    setCreating(true)
    try {
      const result = (await socket.post('share_links', {
        path: newPath.trim(),
        virtual_name: newName.trim() || undefined,
        access: newAccess,
        password: newAccess === 'password' ? newPassword : undefined,
        expires_hours: newExpiry,
        max_downloads: newMaxDownloads,
      })) as ShareLink

      setLastCreatedUrl(result.url || `aurora://${result.id}`)
      toast.success('Share link created')
      setNewPath('')
      setNewName('')
      setNewPassword('')
      fetchLinks()
    } catch {
      toast.error('Failed to create link')
    }
    setCreating(false)
  }

  const handleDelete = async (id: string) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.delete(`share_links/${id}`)
      setLinks((prev) => prev.filter((l) => l.id !== id))
      toast.success('Link deleted')
    } catch {
      toast.error('Failed to delete link')
    }
  }

  const handleToggle = async (link: ShareLink) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.patch(`share_links/${link.id}`, { active: !link.active })
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, active: !l.active } : l))
      )
      toast.success(link.active ? 'Link deactivated' : 'Link activated')
    } catch {
      toast.error('Failed to update link')
    }
  }

  const copyLink = (id: string) => {
    const url = `aurora://${id}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.info(`Link: ${url}`)
    })
  }

  const activeLinks = links.filter((l) => l.active)
  const inactiveLinks = links.filter((l) => !l.active)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-2xl text-(--color-text-primary)">Share Links</h1>
          <p className="text-caption mt-0.5">Create direct download links to your files</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors cursor-pointer"
        >
          <Plus size={13} />
          Create Link
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl bg-(--color-surface-2) border border-(--color-accent)/20 p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-(--color-text-primary)">New Share Link</h3>
            <button type="button" onClick={() => setShowCreate(false)} className="text-(--color-text-tertiary) hover:text-(--color-text-primary) cursor-pointer">
              <X size={15} />
            </button>
          </div>

          {/* Path */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-micro block mb-1">File or Directory Path</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="C:\Users\Public\SharedFiles\movie.mp4"
                  autoFocus
                  className="flex-1 h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs font-mono placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) transition-colors"
                />
                {isTauriAvailable() && (
                  <button
                    type="button"
                    onClick={async () => {
                      const path = await pickPath({ title: 'Select file or folder to share' })
                      if (path) setNewPath(path)
                    }}
                    className="h-9 px-3 rounded-lg bg-(--color-surface-4) hover:bg-(--color-surface-5) text-(--color-text-secondary) text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <FolderSearch size={14} />
                    Browse
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-micro block mb-1">Display Name (optional)</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Awesome Movie"
                className="w-full h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) transition-colors"
              />
            </div>
          </div>

          {/* Access control */}
          <div>
            <label className="text-micro block mb-1.5">Access Control</label>
            <div className="flex gap-2">
              {ACCESS_OPTIONS.map((opt) => {
                const Icon = opt.icon
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNewAccess(opt.id)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                      newAccess === opt.id
                        ? 'border-(--color-accent) bg-(--color-accent)/10'
                        : 'border-(--color-glass-border) hover:border-(--color-text-disabled)'
                    }`}
                  >
                    <Icon size={14} className={newAccess === opt.id ? 'text-(--color-link)' : 'text-(--color-text-tertiary)'} />
                    <div className="text-left">
                      <span className="text-xs text-(--color-text-primary) block">{opt.label}</span>
                      <span className="text-micro">{opt.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Password field */}
          {newAccess === 'password' && (
            <div>
              <label className="text-micro block mb-1">Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter a password"
                className="w-full max-w-xs h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs focus:outline-none focus:border-(--color-accent) transition-colors"
              />
            </div>
          )}

          {/* Options row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-micro block mb-1">Expires</label>
              <select
                value={newExpiry}
                onChange={(e) => setNewExpiry(Number(e.target.value))}
                className="h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs focus:outline-none cursor-pointer"
              >
                {EXPIRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-micro block mb-1">Max Downloads (0 = unlimited)</label>
              <input
                type="number"
                value={newMaxDownloads}
                onChange={(e) => setNewMaxDownloads(Number(e.target.value))}
                min={0}
                className="w-24 h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs focus:outline-none focus:border-(--color-accent) transition-colors"
              />
            </div>
          </div>

          {/* Last created URL */}
          {lastCreatedUrl && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-(--color-success)/10 border border-(--color-success)/20">
              <Link2 size={14} className="text-(--color-success) shrink-0" />
              <span className="text-xs text-(--color-text-primary) font-mono flex-1 select-all">{lastCreatedUrl}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(lastCreatedUrl)
                  toast.success('Copied!')
                }}
                className="flex items-center gap-1 px-2 py-1 rounded bg-(--color-surface-3) text-xs text-(--color-text-secondary) cursor-pointer"
              >
                <Copy size={11} />
                Copy
              </button>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating || !newPath.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Link2 size={13} />
              {creating ? 'Creating...' : 'Create Link'}
            </button>
          </div>
        </form>
      )}

      {/* Link list */}
      {loading ? (
        <p className="text-caption text-center py-12">Loading...</p>
      ) : links.length === 0 ? (
        <div className="text-center py-16">
          <Link2 size={32} className="mx-auto text-(--color-text-disabled) mb-3" />
          <p className="text-caption">No share links yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-3 text-xs text-(--color-link) hover:underline cursor-pointer"
          >
            Create your first share link
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {activeLinks.map((link) => (
            <LinkCard key={link.id} link={link} onCopy={copyLink} onDelete={handleDelete} onToggle={handleToggle} />
          ))}
          {inactiveLinks.length > 0 && (
            <>
              <p className="text-micro pt-2">Inactive ({inactiveLinks.length})</p>
              {inactiveLinks.map((link) => (
                <LinkCard key={link.id} link={link} onCopy={copyLink} onDelete={handleDelete} onToggle={handleToggle} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function LinkCard({
  link,
  onCopy,
  onDelete,
  onToggle,
}: {
  link: ShareLink
  onCopy: (id: string) => void
  onDelete: (id: string) => void
  onToggle: (link: ShareLink) => void
}) {
  const accessIcon = {
    public: Globe,
    password: Key,
    invite: Shield,
    users: Users,
  }[link.access] || Globe
  const AccessIcon = accessIcon

  const isExpired = link.expires_at > 0 && Date.now() / 1000 > link.expires_at
  const isLimited = link.max_downloads > 0 && link.download_count >= link.max_downloads

  return (
    <div className={`rounded-xl bg-(--color-surface-2) p-4 space-y-2 ${!link.active ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <Link2 size={16} className={link.active && !isExpired ? 'text-(--color-link)' : 'text-(--color-text-disabled)'} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-(--color-text-primary) font-medium truncate">
            {link.virtual_name || link.path.split(/[/\\]/).pop()}
          </p>
          <p className="text-micro font-mono truncate">{link.path}</p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${
          link.access === 'public' ? 'bg-(--color-success)/10 text-(--color-success)' :
          link.access === 'password' ? 'bg-(--color-warning)/10 text-(--color-warning)' :
          'bg-(--color-accent)/10 text-(--color-link)'
        }`}>
          <AccessIcon size={10} />
          {link.access}
        </span>
        {isExpired && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-error)/10 text-(--color-error)">expired</span>
        )}
      </div>

      <div className="flex items-center gap-4 text-micro">
        <span className="flex items-center gap-1">
          <Download size={10} />
          {link.download_count}{link.max_downloads > 0 ? `/${link.max_downloads}` : ''} downloads
        </span>
        {link.expires_at > 0 && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {isExpired ? 'Expired' : `Expires ${new Date(link.expires_at * 1000).toLocaleDateString()}`}
          </span>
        )}
        <span>by {link.created_by}</span>
        <div className="flex-1" />
        <button onClick={() => onCopy(link.id)} className="flex items-center gap-1 text-xs text-(--color-link) hover:underline cursor-pointer">
          <Copy size={11} />
          Copy
        </button>
        <button onClick={() => onToggle(link)} className="text-xs text-(--color-text-tertiary) hover:text-(--color-text-primary) cursor-pointer">
          {link.active ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button onClick={() => onDelete(link.id)} className="text-(--color-text-disabled) hover:text-(--color-error) cursor-pointer">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
