import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router'
import { getSocket } from '@/api/socket'
import { formatBytes } from '@/lib/utils'
import { toast } from '@/components/shared/Toast'
import { File, Folder, ChevronRight, Download, Loader2, RefreshCw, AlertCircle } from 'lucide-react'

interface FilelistItem {
  name: string
  type: { id: string; str: string; content_type?: string }
  size: number
  tth?: string
  date?: number
  path: string
  dupe?: { id: string; paths: string[] }
}

interface Filelist {
  id: string
  user: { cid: string; nicks: string; hub_url: string; hub_names: string; flags: string[] }
  state: { id: string; str: string; time_finished: number }
  total_files: number
  total_size: number
  partial_list: boolean
  location?: { path: string }
}

export function FilelistSession() {
  const { id } = useParams<{ id: string }>()
  const listId = id || ''
  const [filelist, setFilelist] = useState<Filelist | null>(null)
  const [items, setItems] = useState<FilelistItem[]>([])
  const [currentPath, setCurrentPath] = useState('/')
  const [loading, setLoading] = useState(true)
  const [filelistReady, setFilelistReady] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch filelist info and poll until ready
  useEffect(() => {
    if (!listId) return

    const socket = getSocket()
    if (!socket) return

    const checkFilelist = async () => {
      try {
        const data = (await socket.get(`filelists/${listId}`)) as Filelist
        setFilelist(data)

        if (data.state.id === 'loaded' || data.state.id === 'download_failed') {
          setFilelistReady(true)
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          if (data.state.id === 'loaded') {
            fetchDirectory('/')
          }
        }
      } catch {
        // Filelist not found or not accessible yet
      }
      setLoading(false)
    }

    checkFilelist()

    // Poll every 2s while waiting for download
    pollRef.current = setInterval(checkFilelist, 2000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [listId])

  const fetchDirectory = async (path: string) => {
    const socket = getSocket()
    if (!socket) return
    setLoading(true)
    try {
      const data = (await socket.post(`filelists/${listId}/directory`, {
        list_path: path,
      })) as FilelistItem[]
      setItems(data)
      setCurrentPath(path)
    } catch {
      // Directory browse failed — might be partial list
      setItems([])
    }
    setLoading(false)
  }

  const handleNavigate = (item: FilelistItem) => {
    if (item.type.id === 'directory') {
      fetchDirectory(item.path + item.name + '/')
    }
  }

  const handleDownload = async (item: FilelistItem) => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`filelists/${listId}/directory_downloads`, {
        list_path: item.type.id === 'directory'
          ? item.path + item.name + '/'
          : item.path + item.name,
      })
      toast.success(`Downloading: ${item.name}`)
    } catch {
      toast.error(`Download failed: ${item.name}`)
    }
  }

  const handleDownloadAll = async () => {
    const socket = getSocket()
    if (!socket) return
    try {
      await socket.post(`filelists/${listId}/directory_downloads`, {
        list_path: currentPath,
      })
      toast.success(`Downloading directory: ${currentPath}`)
    } catch {
      toast.error('Download failed')
    }
  }

  const breadcrumbs = currentPath.split('/').filter(Boolean)
  const stateId = filelist?.state.id || 'unknown'
  const isPending = stateId === 'download_pending' || stateId === 'downloading'
  const isFailed = stateId === 'download_failed'
  const userName = filelist?.user.nicks || filelist?.user.cid || 'User'

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading text-2xl text-(--color-text-primary)">
            {userName}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className={`text-caption ${isPending ? 'text-(--color-warning)' : isFailed ? 'text-(--color-error)' : ''}`}>
              {filelist?.state.str || 'Loading...'}
            </span>
            {filelist && filelist.total_size > 0 && (
              <span className="text-micro">
                {filelist.total_files} files &middot; {formatBytes(filelist.total_size)}
              </span>
            )}
            {filelist?.user.hub_names && (
              <span className="text-micro">{filelist.user.hub_names}</span>
            )}
          </div>
        </div>
        {filelistReady && currentPath !== '/' && (
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-accent) hover:bg-(--color-accent-hover) text-white text-xs font-medium transition-colors cursor-pointer"
          >
            <Download size={13} />
            Download folder
          </button>
        )}
      </div>

      {/* Pending/downloading state */}
      {isPending && (
        <div className="rounded-xl bg-(--color-surface-2) p-8 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-(--color-accent)" />
          <p className="text-sm text-(--color-text-primary)">Waiting for filelist...</p>
          <p className="text-micro text-center max-w-md">
            The user's filelist is being downloaded. This may take a moment
            depending on the user's connection and share size.
            {filelist?.user.flags?.includes('offline') && (
              <span className="block mt-1 text-(--color-warning)">
                User appears to be offline. The download will start when they come back online.
              </span>
            )}
          </p>
        </div>
      )}

      {/* Failed state */}
      {isFailed && (
        <div className="rounded-xl bg-(--color-surface-2) p-8 flex flex-col items-center gap-3">
          <AlertCircle size={28} className="text-(--color-error)" />
          <p className="text-sm text-(--color-text-primary)">Filelist download failed</p>
          <p className="text-micro">The user may be offline or has denied the request.</p>
        </div>
      )}

      {/* File browser — only when loaded */}
      {filelistReady && stateId === 'loaded' && (
        <>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-xs flex-wrap">
            <button
              onClick={() => fetchDirectory('/')}
              className="text-(--color-link) hover:underline cursor-pointer"
            >
              Root
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight size={12} className="text-(--color-text-disabled)" />
                <button
                  onClick={() => fetchDirectory('/' + breadcrumbs.slice(0, i + 1).join('/') + '/')}
                  className="text-(--color-link) hover:underline cursor-pointer"
                >
                  {crumb}
                </button>
              </span>
            ))}
          </div>

          {/* File list */}
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 size={16} className="animate-spin text-(--color-text-tertiary)" />
              <span className="text-caption">Loading...</span>
            </div>
          ) : (
            <div className="rounded-xl bg-(--color-surface-2) divide-y divide-(--color-glass-border) overflow-hidden">
              {currentPath !== '/' && (
                <div
                  className="px-4 py-2 flex items-center gap-3 hover:bg-white/2 transition-colors cursor-pointer"
                  onClick={() => {
                    const parent = currentPath.split('/').slice(0, -2).join('/') + '/'
                    fetchDirectory(parent || '/')
                  }}
                >
                  <Folder size={16} className="text-(--color-text-disabled) shrink-0" />
                  <span className="text-sm text-(--color-text-tertiary)">..</span>
                </div>
              )}
              {items.map((item, i) => (
                <div
                  key={`${item.name}-${i}`}
                  className="px-4 py-2 flex items-center gap-3 hover:bg-white/2 transition-colors cursor-pointer group"
                  onClick={() => handleNavigate(item)}
                >
                  {item.type.id === 'directory' ? (
                    <Folder size={16} className="text-(--color-warning) shrink-0" />
                  ) : (
                    <File size={16} className="text-(--color-text-tertiary) shrink-0" />
                  )}
                  <span className="text-sm text-(--color-text-primary) truncate flex-1">{item.name}</span>
                  <span className="text-micro shrink-0">{formatBytes(item.size)}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(item) }}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-(--color-accent)/10 text-(--color-link) transition-all cursor-pointer"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-caption text-center py-8">Empty directory</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
