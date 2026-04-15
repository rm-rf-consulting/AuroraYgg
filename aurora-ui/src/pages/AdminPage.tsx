import { useEffect, useState } from 'react'
import { getSocket } from '@/api/socket'
import { useAuthStore } from '@/stores/authStore'
import { toast } from '@/components/shared/Toast'
import {
  Users,
  UserPlus,
  Trash2,
  Shield,
  Key,
  Ticket,
  Copy,
  Clock,
  Eye,
  EyeOff,
  Save,
  X,
  Monitor,
  LogOut,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

// All AirDC++ permissions grouped by category
const PERMISSION_GROUPS: { label: string; permissions: { id: string; label: string }[] }[] = [
  {
    label: 'Core',
    permissions: [
      { id: 'admin', label: 'Administrator' },
    ],
  },
  {
    label: 'Search & Download',
    permissions: [
      { id: 'search', label: 'Search' },
      { id: 'download', label: 'Download' },
      { id: 'transfers', label: 'View Transfers' },
    ],
  },
  {
    label: 'Queue',
    permissions: [
      { id: 'queue_view', label: 'View Queue' },
      { id: 'queue_edit', label: 'Edit Queue' },
    ],
  },
  {
    label: 'Hubs & Chat',
    permissions: [
      { id: 'hubs_view', label: 'View Hubs' },
      { id: 'hubs_edit', label: 'Edit Hubs' },
      { id: 'hubs_send', label: 'Send Hub Messages' },
      { id: 'private_chat_view', label: 'View Private Chat' },
      { id: 'private_chat_edit', label: 'Edit Private Chat' },
      { id: 'private_chat_send', label: 'Send Private Messages' },
    ],
  },
  {
    label: 'Share & Files',
    permissions: [
      { id: 'share_view', label: 'View Share' },
      { id: 'share_edit', label: 'Edit Share' },
      { id: 'filesystem_view', label: 'Browse Filesystem' },
      { id: 'filesystem_edit', label: 'Edit Filesystem' },
      { id: 'filelists_view', label: 'View Filelists' },
      { id: 'filelists_edit', label: 'Edit Filelists' },
      { id: 'view_files_view', label: 'View Files' },
      { id: 'view_files_edit', label: 'Edit View Files' },
    ],
  },
  {
    label: 'Settings & Events',
    permissions: [
      { id: 'settings_view', label: 'View Settings' },
      { id: 'settings_edit', label: 'Edit Settings' },
      { id: 'events_view', label: 'View Events' },
      { id: 'events_edit', label: 'Edit Events' },
      { id: 'favorite_hubs_view', label: 'View Favorites' },
      { id: 'favorite_hubs_edit', label: 'Edit Favorites' },
    ],
  },
]

interface WebUser {
  username: string
  permissions: string[]
  last_login: number
  active_sessions: number
}

interface Session {
  id: number
  user: string
  ip: string
  session_token: string
  last_activity: number
  created: number
  secure: boolean
}

interface Invite {
  code: string
  created_by: string
  created_at: number
  expires_at: number
  permissions: string[]
  used: boolean
  used_by: string
}

type Tab = 'users' | 'sessions' | 'invites'

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('users')
  const currentUser = useAuthStore((s) => s.username)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-heading text-2xl text-(--color-text-primary)">Administration</h1>
        <p className="text-caption mt-0.5">Manage users, sessions, and access control</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-(--color-glass-border)">
        {[
          { id: 'users' as Tab, label: 'Users', icon: Users },
          { id: 'sessions' as Tab, label: 'Sessions', icon: Monitor },
          { id: 'invites' as Tab, label: 'Invites', icon: Ticket },
        ].map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 transition-colors cursor-pointer -mb-px ${
                tab === t.id
                  ? 'border-(--color-accent) text-(--color-link)'
                  : 'border-transparent text-(--color-text-tertiary) hover:text-(--color-text-secondary)'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'users' && <UsersTab currentUser={currentUser} />}
      {tab === 'sessions' && <SessionsTab currentUser={currentUser} />}
      {tab === 'invites' && <InvitesTab />}
    </div>
  )
}

/* =============================================
   Users Tab
   ============================================= */

function UsersTab({ currentUser }: { currentUser: string | null }) {
  const [users, setUsers] = useState<WebUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [expandedPerms, setExpandedPerms] = useState<string | null>(null)

  // Create form state
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [newPermissions, setNewPermissions] = useState<Set<string>>(new Set(['search', 'download', 'transfers', 'hubs_view', 'hubs_send', 'queue_view', 'share_view', 'events_view', 'favorite_hubs_view', 'private_chat_view', 'private_chat_send', 'filelists_view']))
  const [creating, setCreating] = useState(false)

  // Edit state
  const [editPassword, setEditPassword] = useState('')
  const [editPermissions, setEditPermissions] = useState<Set<string>>(new Set())

  const fetchUsers = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const data = (await socket.get('web_users')) as WebUser[]
      setUsers(data)
    } catch {
      toast.error('Failed to load users')
    }
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword) return
    const socket = getSocket()
    if (!socket) return

    setCreating(true)
    try {
      await socket.post('web_users', {
        username: newUsername.trim(),
        password: newPassword,
        permissions: Array.from(newPermissions),
      })
      toast.success(`User "${newUsername.trim()}" created`)
      setNewUsername('')
      setNewPassword('')
      setShowCreateForm(false)
      fetchUsers()
    } catch {
      toast.error('Failed to create user')
    }
    setCreating(false)
  }

  const handleDelete = async (username: string) => {
    if (username === currentUser) {
      toast.error("Can't delete your own account")
      return
    }
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.delete(`web_users/${username}`)
      setUsers((prev) => prev.filter((u) => u.username !== username))
      toast.success(`User "${username}" deleted`)
    } catch {
      toast.error('Failed to delete user')
    }
  }

  const startEdit = (user: WebUser) => {
    setEditingUser(user.username)
    setEditPermissions(new Set(user.permissions))
    setEditPassword('')
  }

  const handleSaveEdit = async (username: string) => {
    const socket = getSocket()
    if (!socket) return
    try {
      const update: Record<string, unknown> = {
        permissions: Array.from(editPermissions),
      }
      if (editPassword) {
        update.password = editPassword
      }
      await socket.patch(`web_users/${username}`, update)
      toast.success(`User "${username}" updated`)
      setEditingUser(null)
      fetchUsers()
    } catch {
      toast.error('Failed to update user')
    }
  }

  const togglePermission = (perms: Set<string>, perm: string): Set<string> => {
    const next = new Set(perms)
    if (next.has(perm)) next.delete(perm)
    else next.add(perm)
    return next
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-micro">{users.length} users</span>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors cursor-pointer"
        >
          <UserPlus size={13} />
          Create User
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-xl bg-(--color-surface-2) border border-(--color-accent)/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-(--color-text-primary)">Create New User</h3>
            <button onClick={() => setShowCreateForm(false)} className="text-(--color-text-tertiary) hover:text-(--color-text-primary) cursor-pointer">
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-micro block mb-1">Username</label>
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="username"
                autoFocus
                className="w-full h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) transition-colors"
              />
            </div>
            <div>
              <label className="text-micro block mb-1">Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="password"
                  className="w-full h-9 px-3 pr-9 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-sm placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-(--color-text-disabled) hover:text-(--color-text-tertiary) cursor-pointer"
                >
                  {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <PermissionEditor
            permissions={newPermissions}
            onChange={setNewPermissions}
          />

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreateForm(false)} className="px-4 py-1.5 rounded-lg text-xs text-(--color-text-secondary) hover:bg-white/5 cursor-pointer">Cancel</button>
            <button
              onClick={handleCreate}
              disabled={creating || !newUsername.trim() || !newPassword}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <UserPlus size={13} />
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <p className="text-caption text-center py-12">Loading...</p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => {
            const isEditing = editingUser === user.username
            const isSelf = user.username === currentUser
            const isAdmin = user.permissions.includes('admin')
            const lastLogin = user.last_login
              ? new Date(user.last_login * 1000).toLocaleDateString()
              : 'Never'

            return (
              <div key={user.username} className="rounded-xl bg-(--color-surface-2) p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isAdmin ? 'bg-(--color-accent)/15' : 'bg-(--color-surface-4)'
                  }`}>
                    <Shield size={15} className={isAdmin ? 'text-(--color-accent)' : 'text-(--color-text-tertiary)'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-(--color-text-primary)">{user.username}</span>
                      {isSelf && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-accent)/10 text-(--color-link)">you</span>
                      )}
                      {isAdmin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-warning)/10 text-(--color-warning)">admin</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-micro">
                      <span>Last login: {lastLogin}</span>
                      <span>{user.active_sessions} active session{user.active_sessions !== 1 ? 's' : ''}</span>
                      <span>{user.permissions.length} permission{user.permissions.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(user)}
                        className="px-2.5 py-1 rounded-md text-xs text-(--color-text-tertiary) hover:bg-white/5 hover:text-(--color-text-primary) transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                      {!isSelf && (
                        <button
                          onClick={() => handleDelete(user.username)}
                          className="p-1.5 rounded-md hover:bg-(--color-error)/10 text-(--color-text-disabled) hover:text-(--color-error) transition-colors cursor-pointer"
                          title="Delete user"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Edit mode */}
                {isEditing && (
                  <div className="border-t border-(--color-glass-border) pt-3 space-y-3">
                    <div>
                      <label className="text-micro block mb-1">New Password (leave empty to keep current)</label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="New password..."
                        className="w-full max-w-xs h-8 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) transition-colors"
                      />
                    </div>

                    <PermissionEditor
                      permissions={editPermissions}
                      onChange={setEditPermissions}
                    />

                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingUser(null)} className="px-3 py-1.5 rounded-lg text-xs text-(--color-text-secondary) hover:bg-white/5 cursor-pointer">Cancel</button>
                      <button
                        onClick={() => handleSaveEdit(user.username)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium cursor-pointer"
                      >
                        <Save size={13} />
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* =============================================
   Permission Editor
   ============================================= */

function PermissionEditor({
  permissions,
  onChange,
}: {
  permissions: Set<string>
  onChange: (perms: Set<string>) => void
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const isAdmin = permissions.has('admin')

  const toggle = (perm: string) => {
    const next = new Set(permissions)
    if (next.has(perm)) next.delete(perm)
    else next.add(perm)
    onChange(next)
  }

  const selectAll = () => {
    const all = new Set<string>()
    PERMISSION_GROUPS.forEach((g) => g.permissions.forEach((p) => all.add(p.id)))
    onChange(all)
  }

  const selectNone = () => onChange(new Set())

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-micro font-medium">Permissions</span>
        <button onClick={selectAll} className="text-[10px] text-(--color-link) hover:underline cursor-pointer">All</button>
        <button onClick={selectNone} className="text-[10px] text-(--color-link) hover:underline cursor-pointer">None</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {PERMISSION_GROUPS.map((group) => {
          const groupSelected = group.permissions.filter((p) => permissions.has(p.id)).length
          return (
            <div key={group.label} className="rounded-lg bg-(--color-surface-3) overflow-hidden">
              <button
                onClick={() => setExpandedGroup(expandedGroup === group.label ? null : group.label)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer hover:bg-white/3 transition-colors"
              >
                {expandedGroup === group.label ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="text-xs text-(--color-text-secondary) flex-1">{group.label}</span>
                <span className="text-micro">{groupSelected}/{group.permissions.length}</span>
              </button>
              {expandedGroup === group.label && (
                <div className="px-3 pb-2 space-y-1">
                  {group.permissions.map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-center gap-2 py-0.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={permissions.has(perm.id) || (isAdmin && perm.id !== 'admin')}
                        disabled={isAdmin && perm.id !== 'admin'}
                        onChange={() => toggle(perm.id)}
                        className="w-3.5 h-3.5 rounded accent-(--color-accent)"
                      />
                      <span className={`text-xs ${
                        isAdmin && perm.id !== 'admin' ? 'text-(--color-text-disabled)' : 'text-(--color-text-secondary)'
                      }`}>
                        {perm.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      {isAdmin && (
        <p className="text-micro italic">Admin has all permissions implicitly</p>
      )}
    </div>
  )
}

/* =============================================
   Sessions Tab
   ============================================= */

function SessionsTab({ currentUser }: { currentUser: string | null }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const data = (await socket.get('sessions')) as Session[]
      setSessions(data)
    } catch {
      toast.error('Failed to load sessions')
    }
    setLoading(false)
  }

  useEffect(() => { fetchSessions() }, [])

  const handleForceLogout = async (sessionToken: string) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.delete(`sessions/${sessionToken}`)
      toast.success('Session terminated')
      fetchSessions()
    } catch {
      toast.error('Failed to terminate session')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-micro">{sessions.length} active session{sessions.length !== 1 ? 's' : ''}</span>
        <button
          onClick={fetchSessions}
          className="px-3 py-1.5 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-4) text-xs text-(--color-text-secondary) transition-colors cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-caption text-center py-12">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="text-caption text-center py-12">No active sessions</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <div key={session.id} className="rounded-xl bg-(--color-surface-2) p-4 flex items-center gap-4">
              <Monitor size={16} className="text-(--color-text-tertiary) shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-(--color-text-primary) font-medium">{session.user}</span>
                  {session.secure && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-success)/10 text-(--color-success)">TLS</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-micro">
                  <span>IP: {session.ip || 'unknown'}</span>
                  <span>
                    Active: {new Date(session.last_activity * 1000).toLocaleTimeString()}
                  </span>
                  <span>
                    Created: {new Date(session.created * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleForceLogout(session.session_token)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-(--color-text-tertiary) hover:bg-(--color-error)/10 hover:text-(--color-error) transition-colors cursor-pointer"
                title="Force logout"
              >
                <LogOut size={13} />
                Terminate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* =============================================
   Invites Tab
   ============================================= */

function InvitesTab() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [expiresHours, setExpiresHours] = useState(72)
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null)

  const fetchInvites = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const data = (await socket.get('web_users/invites')) as Invite[]
      setInvites(data)
    } catch {
      toast.error('Failed to load invites')
    }
    setLoading(false)
  }

  useEffect(() => { fetchInvites() }, [])

  const handleCreate = async () => {
    const socket = getSocket()
    if (!socket) return
    setCreating(true)
    try {
      const result = (await socket.post('web_users/invites', {
        expires_hours: expiresHours,
      })) as { code: string }
      setLastCreatedCode(result.code)
      toast.success('Invite code created')
      fetchInvites()
    } catch {
      toast.error('Failed to create invite')
    }
    setCreating(false)
  }

  const handleDelete = async (code: string) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.delete(`web_users/invites/${code}`)
      setInvites((prev) => prev.filter((i) => i.code !== code))
      toast.success('Invite revoked')
    } catch {
      toast.error('Failed to revoke invite')
    }
  }

  const copyInviteLink = (code: string) => {
    const link = `${window.location.origin}${window.location.pathname}#/register?invite=${code}`
    navigator.clipboard.writeText(link).then(() => {
      toast.success('Invite link copied to clipboard')
    }).catch(() => {
      toast.info(`Invite code: ${code}`)
    })
  }

  const activeInvites = invites.filter((i) => !i.used)
  const usedInvites = invites.filter((i) => i.used)

  return (
    <div className="space-y-4">
      {/* Create invite */}
      <div className="rounded-xl bg-(--color-surface-2) p-4 space-y-3">
        <h3 className="text-sm font-semibold text-(--color-text-primary)">Generate Invite</h3>
        <p className="text-caption text-sm">
          Create a one-time invite code that allows a new user to register.
        </p>
        <div className="flex items-end gap-3">
          <div>
            <label className="text-micro block mb-1">Expires in</label>
            <select
              value={expiresHours}
              onChange={(e) => setExpiresHours(Number(e.target.value))}
              className="h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs focus:outline-none focus:border-(--color-accent) cursor-pointer"
            >
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
              <option value={720}>30 days</option>
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <Ticket size={13} />
            {creating ? 'Creating...' : 'Generate Code'}
          </button>
        </div>

        {/* Show last created code */}
        {lastCreatedCode && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-(--color-success)/10 border border-(--color-success)/20">
            <span className="text-xs text-(--color-text-primary) font-mono flex-1 select-all">
              {lastCreatedCode}
            </span>
            <button
              onClick={() => copyInviteLink(lastCreatedCode)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-(--color-surface-3) text-xs text-(--color-text-secondary) hover:text-(--color-text-primary) transition-colors cursor-pointer"
            >
              <Copy size={12} />
              Copy Link
            </button>
          </div>
        )}
      </div>

      {/* Active invites */}
      {loading ? (
        <p className="text-caption text-center py-8">Loading...</p>
      ) : (
        <>
          {activeInvites.length > 0 && (
            <div className="space-y-2">
              <span className="text-micro font-medium px-1">
                Active invites ({activeInvites.length})
              </span>
              {activeInvites.map((inv) => (
                <div key={inv.code} className="rounded-xl bg-(--color-surface-2) p-4 flex items-center gap-4">
                  <Ticket size={16} className="text-(--color-link) shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-(--color-text-primary) font-mono block truncate">
                      {inv.code}
                    </span>
                    <div className="flex items-center gap-3 text-micro mt-0.5">
                      <span>By: {inv.created_by}</span>
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        Expires: {new Date(inv.expires_at * 1000).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => copyInviteLink(inv.code)}
                    className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-tertiary) hover:text-(--color-link) transition-colors cursor-pointer"
                    title="Copy invite link"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(inv.code)}
                    className="p-1.5 rounded-md hover:bg-(--color-error)/10 text-(--color-text-disabled) hover:text-(--color-error) transition-colors cursor-pointer"
                    title="Revoke invite"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Used invites */}
          {usedInvites.length > 0 && (
            <div className="space-y-2">
              <span className="text-micro font-medium px-1">
                Used invites ({usedInvites.length})
              </span>
              {usedInvites.map((inv) => (
                <div key={inv.code} className="rounded-xl bg-(--color-surface-2) p-4 flex items-center gap-4 opacity-60">
                  <Ticket size={16} className="text-(--color-text-disabled) shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-(--color-text-tertiary) font-mono block truncate">
                      {inv.code}
                    </span>
                    <div className="flex items-center gap-3 text-micro mt-0.5">
                      <span>Redeemed by: {inv.used_by}</span>
                      <span>Created by: {inv.created_by}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {invites.length === 0 && (
            <p className="text-caption text-center py-8">No invites created yet</p>
          )}
        </>
      )}
    </div>
  )
}
