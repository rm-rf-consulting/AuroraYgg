import { useEffect, useState, type FormEvent } from 'react'
import { getSocket } from '@/api/socket'
import { formatBytes } from '@/lib/utils'
import { toast } from '@/components/shared/Toast'
import { pickFolder, isTauriAvailable } from '@/hooks/useFilePicker'
import {
  FolderOpen, Plus, Trash2, RefreshCw, X, Loader2,
  FolderSearch, ChevronDown, ChevronRight, File, Edit3, Save,
} from 'lucide-react'

interface ShareRoot {
  id: number
  virtual_name: string
  path: string
  incoming: boolean
  profiles: { id: number; str: string }[]
  type: { id: string; str: string }
  size: number
  status: { id: string; str: string }
  last_refresh_time: number
}

interface SharedFile {
  id: string
  name: string
  path: string
  size: number
  tth: string
  time: number
  type: { id: string; str: string; content_type: string }
  virtual_path: string
}

export function SharePage() {
  const [roots, setRoots] = useState<ShareRoot[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newPath, setNewPath] = useState('')
  const [newVirtualName, setNewVirtualName] = useState('')
  const [adding, setAdding] = useState(false)
  const [expandedRoot, setExpandedRoot] = useState<number | null>(null)
  const [rootFiles, setRootFiles] = useState<Record<string, SharedFile[]>>({})
  const [loadingFiles, setLoadingFiles] = useState<string | null>(null)
  const [editingRoot, setEditingRoot] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editIncoming, setEditIncoming] = useState(false)

  const fetchRoots = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      const data = (await socket.get('share_roots')) as ShareRoot[]
      setRoots(data)
    } catch {
      toast.error('Failed to load share roots')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRoots() }, [])

  const handleRefresh = async () => {
    const socket = getSocket()
    if (!socket) return
    setRefreshing(true)
    try {
      await socket.post('share/refresh')
      toast.success('Share refresh started')
    } catch {
      toast.error('Failed to refresh share')
    }
    setRefreshing(false)
  }

  const handleRemoveRoot = async (root: ShareRoot) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.delete(`share_roots/${root.id}`)
      setRoots((prev) => prev.filter((r) => r.id !== root.id))
      toast.success(`Removed: ${root.virtual_name}`)
    } catch {
      toast.error('Failed to remove share root')
    }
  }

  const handleAddRoot = async (e: FormEvent) => {
    e.preventDefault()
    if (!newPath.trim()) return
    const socket = getSocket()
    if (!socket) return
    setAdding(true)
    try {
      await socket.post('share_roots', {
        path: newPath.trim(),
        virtual_name: newVirtualName.trim() || undefined,
        incoming: false,
      })
      toast.success(`Added share: ${newPath.trim()}`)
      setNewPath('')
      setNewVirtualName('')
      setShowAddForm(false)
      fetchRoots()
    } catch {
      toast.error('Failed to add share root')
    }
    setAdding(false)
  }

  const handleBrowseRoot = async (root: ShareRoot) => {
    if (expandedRoot === root.id) {
      setExpandedRoot(null)
      return
    }
    setExpandedRoot(root.id)
    if (rootFiles[root.path]) return // already loaded

    setLoadingFiles(root.path)
    const socket = getSocket()
    if (!socket) return
    try {
      const data = (await socket.post('share/directories/by_real/content/0/200', {
        path: root.path,
      })) as SharedFile[]
      setRootFiles((prev) => ({ ...prev, [root.path]: data }))
    } catch {
      toast.error('Failed to load directory contents')
    }
    setLoadingFiles(null)
  }

  const startEdit = (root: ShareRoot) => {
    setEditingRoot(root.id)
    setEditName(root.virtual_name)
    setEditIncoming(root.incoming)
  }

  const handleSaveEdit = async (root: ShareRoot) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.patch(`share_roots/${root.id}`, {
        virtual_name: editName,
        incoming: editIncoming,
      })
      toast.success(`Updated: ${editName}`)
      setEditingRoot(null)
      fetchRoots()
    } catch {
      toast.error('Failed to update share root')
    }
  }

  const totalSize = roots.reduce((sum, r) => sum + (r.size || 0), 0)
  const totalFiles = Object.values(rootFiles).reduce((sum, files) => sum + files.length, 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-2xl text-(--color-text-primary)">Share</h1>
          <p className="text-caption mt-0.5">
            {roots.length} director{roots.length !== 1 ? 'ies' : 'y'} &middot; {formatBytes(totalSize)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus size={13} />
            Add Directory
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-surface-3) hover:bg-(--color-surface-4) text-(--color-text-secondary) text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Add directory form */}
      {showAddForm && (
        <form onSubmit={handleAddRoot} className="rounded-xl bg-(--color-surface-2) border border-(--color-accent)/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-(--color-text-primary)">Add Share Directory</h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-(--color-text-tertiary) hover:text-(--color-text-primary) cursor-pointer"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-micro block mb-1">Path</label>
              <div className="flex gap-1.5">
                <input type="text" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="C:\Users\Public\Share" autoFocus className="flex-1 h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs font-mono placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) transition-colors" />
                {isTauriAvailable() && (
                  <button type="button" onClick={async () => { const p = await pickFolder(); if (p) setNewPath(p) }} className="h-9 px-3 rounded-lg bg-(--color-surface-4) hover:bg-(--color-surface-5) text-(--color-text-secondary) text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5">
                    <FolderSearch size={14} />Browse
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-micro block mb-1">Virtual Name</label>
              <input type="text" value={newVirtualName} onChange={(e) => setNewVirtualName(e.target.value)} placeholder="My Share" className="w-full h-9 px-3 rounded-lg bg-(--color-surface-3) border border-(--color-glass-border) text-(--color-text-primary) text-xs placeholder:text-(--color-text-disabled) focus:outline-none focus:border-(--color-accent) transition-colors" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={adding || !newPath.trim()} className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed">
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {adding ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {/* Root list */}
      {loading ? (
        <p className="text-caption text-center py-12">Loading...</p>
      ) : roots.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen size={32} className="mx-auto text-(--color-text-disabled) mb-3" />
          <p className="text-caption">No shared directories</p>
          <button onClick={() => setShowAddForm(true)} className="mt-3 text-xs text-(--color-link) hover:underline cursor-pointer">Add your first share directory</button>
        </div>
      ) : (
        <div className="space-y-2">
          {roots.map((root) => {
            const isExpanded = expandedRoot === root.id
            const files = rootFiles[root.path] || []
            const isEditing = editingRoot === root.id

            return (
              <div key={root.id} className="rounded-xl bg-(--color-surface-2) overflow-hidden">
                {/* Root header */}
                <div className="p-4 flex items-center gap-3">
                  <button onClick={() => handleBrowseRoot(root)} className="cursor-pointer text-(--color-text-tertiary) hover:text-(--color-text-primary)">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <FolderOpen size={20} className="text-(--color-warning) shrink-0" />
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="h-7 px-2 rounded bg-(--color-surface-3) border border-(--color-glass-border) text-sm text-(--color-text-primary) focus:outline-none focus:border-(--color-accent) transition-colors" />
                        <label className="flex items-center gap-1.5 text-xs text-(--color-text-secondary) cursor-pointer">
                          <input type="checkbox" checked={editIncoming} onChange={(e) => setEditIncoming(e.target.checked)} className="accent-(--color-accent)" />
                          Incoming
                        </label>
                        <button onClick={() => handleSaveEdit(root)} className="p-1 rounded text-(--color-success) hover:bg-(--color-success)/10 cursor-pointer"><Save size={14} /></button>
                        <button onClick={() => setEditingRoot(null)} className="p-1 rounded text-(--color-text-tertiary) hover:bg-white/5 cursor-pointer"><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-(--color-text-primary) font-medium">{root.virtual_name}</p>
                        <p className="text-micro truncate font-mono">{root.path}</p>
                      </>
                    )}
                  </div>
                  <span className="text-micro shrink-0">{formatBytes(root.size)}</span>
                  <span className={`text-micro shrink-0 ${root.status.id === 'normal' ? 'text-(--color-success)' : 'text-(--color-text-tertiary)'}`}>
                    {root.status.str}
                  </span>
                  {root.incoming && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-(--color-success)/10 text-(--color-success)">Incoming</span>
                  )}
                  {!isEditing && (
                    <button onClick={() => startEdit(root)} className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-disabled) hover:text-(--color-link) transition-colors cursor-pointer" title="Edit">
                      <Edit3 size={14} />
                    </button>
                  )}
                  <button onClick={() => handleRemoveRoot(root)} className="p-1.5 rounded-md hover:bg-white/5 text-(--color-text-tertiary) hover:text-(--color-error) transition-colors cursor-pointer" title="Remove">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* File list */}
                {isExpanded && (
                  <div className="border-t border-(--color-glass-border)">
                    {loadingFiles === root.path ? (
                      <div className="flex items-center justify-center py-6 gap-2">
                        <Loader2 size={14} className="animate-spin text-(--color-text-tertiary)" />
                        <span className="text-micro">Loading files...</span>
                      </div>
                    ) : files.length === 0 ? (
                      <p className="text-micro text-center py-6">No files</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        <div className="px-4 py-1.5 border-b border-(--color-glass-border)/50 flex items-center">
                          <span className="text-micro">{files.length} files</span>
                        </div>
                        {files.map((file) => (
                          <div key={file.id} className="px-4 py-1.5 flex items-center gap-3 hover:bg-white/2 text-xs border-b border-(--color-glass-border)/30 last:border-none">
                            <File size={14} className="text-(--color-text-disabled) shrink-0" />
                            <span className="text-(--color-text-secondary) truncate flex-1">{file.name}</span>
                            <span className="text-micro shrink-0 font-mono uppercase">{file.type.str}</span>
                            <span className="text-micro shrink-0">{formatBytes(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
